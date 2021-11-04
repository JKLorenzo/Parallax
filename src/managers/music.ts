import {
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  DiscordGatewayAdapterCreator,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import {
  CommandInteraction,
  Guild,
  GuildMember,
  MessageComponentInteraction,
  Snowflake,
  TextChannel,
  VoiceState,
} from 'discord.js';
import fetch from 'node-fetch';
import playdl from 'play-dl';
import { client } from '../main.js';
import { getSoundCloudPlaylist, getSoundCloudTrack } from '../modules/soundcloud.js';
import { synthesize } from '../modules/speech.js';
import { getSpotifyPlaylist, getSpotifyTrack } from '../modules/spotify.js';
import Subscription from '../structures/subscription.js';
import Track from '../structures/track.js';

const _subscriptions = new Map<Snowflake, Subscription>();

export async function initMusic(): Promise<void> {
  const active_guilds = client.guilds.cache.filter(guild => {
    const member = guild.me;
    if (!member) return false;
    if (!member.voice.channelId) return false;
    return true;
  });

  if (active_guilds.size > 0) {
    const resource = await synthesize(
      'All queued music was removed due to a bot restart. I will now disconnect from this channel.',
    );
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    for (const guild of active_guilds.values()) {
      const channelId = guild.me?.voice.channelId;
      if (!channelId) continue;

      const connection = joinVoiceChannel({
        channelId: channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      } catch (error) {
        connection.destroy();
      }

      connection.subscribe(player);
    }

    player.play(resource);

    player.on('stateChange', (oldState, newState) => {
      if (
        oldState.status === AudioPlayerStatus.Playing &&
        newState.status === AudioPlayerStatus.Idle
      ) {
        for (const guild of active_guilds.values()) {
          guild.me?.voice.disconnect();
        }
        player.removeAllListeners();
        console.log('Playback has stopped');
      }
    });
  }

  playdl.setToken({
    soundcloud: {
      client_id: process.env.SOUNDCLOUD_ID!,
    },
  });

  client.on('voiceStateUpdate', processVoiceStateUpdate);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function processVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const bot_channel = oldState.guild.me?.voice.channel;
  const member_channel = oldState.channel;

  if (!bot_channel || !member_channel || bot_channel.id !== member_channel.id) return;
  if (bot_channel.members.filter(m => !m.user.bot).size > 0) return;

  const subscription = getSubscription(oldState.guild.id);
  if (subscription) {
    subscription.voiceConnection.destroy();
    deleteSubscription(oldState.guild.id);
  }
  await oldState.guild.me?.voice.disconnect();
}

export function getSubscription(guild_id: Snowflake): Subscription | undefined {
  return _subscriptions.get(guild_id);
}

export function setSubscription(guild_id: Snowflake, subscription: Subscription): void {
  _subscriptions.set(guild_id, subscription);
}

export function deleteSubscription(guild_id: Snowflake): void {
  _subscriptions.delete(guild_id);
}

export async function musicPlay(interaction: CommandInteraction): Promise<unknown> {
  await interaction.deferReply();

  const song = interaction.options.getString('song', true).trim();
  const guild = interaction.guild as Guild;
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;
  const current_voice_channel = guild.me?.voice.channel;
  let subscription = getSubscription(guild.id);

  if (subscription && subscription.queue.length > 0 && current_voice_channel?.id !== channel?.id) {
    return interaction.followUp("I'm currently playing on another channel.");
  }

  if (
    channel &&
    (!subscription ||
      (subscription.audioPlayer.state.status === AudioPlayerStatus.Idle &&
        subscription.queue.length === 0))
  ) {
    subscription = new Subscription(
      joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
      }),
    );
    subscription.voiceConnection.on('error', console.warn);
    setSubscription(guild.id, subscription);
  }

  if (!subscription) {
    return interaction.followUp('Join a voice channel and then try that again.');
  }

  try {
    await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
  } catch (error) {
    console.warn(error);
    return interaction.followUp(
      'Failed to join voice channel within 20 seconds, please try again later.',
    );
  }

  try {
    const enqueue = (query: string, title?: string, image?: string): Promise<number> =>
      subscription!.enqueue(interaction.channel as TextChannel, query, title, image);

    let type = await playdl.validate(song);
    if (type === 'search') {
      const results = await playdl.search(song, { limit: 1 });
      if (results.length === 0) return interaction.editReply('No match found.');

      const result = results[0] as playdl.YouTube;
      const video_info = await playdl.video_info(result.url!);

      const title = video_info.video_details.title;
      const uploader = video_info.video_details.channel?.name;

      const position = await enqueue(
        video_info.video_details.url,
        `${title} by ${uploader}`,
        video_info.video_details.thumbnail?.url,
      );

      await interaction.editReply(
        `Enqueued **${title}** by **${uploader}**${
          position > 0 ? ` at position ${position}` : ''
        }.`,
      );
    } else {
      // Handle shortened urls
      const redirect = await fetch(song);
      const url = redirect.url;
      type = await playdl.validate(redirect.url);

      if (type === 'yt_video') {
        const video_info = await playdl.video_info(url);

        const title = video_info.video_details.title;
        const uploader = video_info.video_details.channel?.name;

        const position = await enqueue(
          url,
          `${title} by ${uploader}`,
          video_info.video_details.thumbnail?.url,
        );

        await interaction.editReply(
          `Enqueued **${title}** by **${uploader}**${
            position > 0 ? ` at position ${position}` : ''
          }.`,
        );
      } else if (type === 'yt_playlist') {
        const playlist_info = await playdl.playlist_info(url);
        await playlist_info.fetch();

        for (let page = 1; page <= playlist_info.total_pages; page++) {
          const video_infos = await playlist_info.page(page);

          for (let i = video_infos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = video_infos[i];
            video_infos[i] = video_infos[j];
            video_infos[j] = temp;
          }

          for (const video_info of video_infos) {
            const title = video_info.title;
            const uploader = video_info.channel?.name;
            enqueue(video_info.url, `${title} by ${uploader}`, video_info.thumbnail?.url);
          }
        }

        await interaction.editReply(
          `Enqueued ${playlist_info.total_videos} songs from **${playlist_info.title}** playlist ` +
            `by **${playlist_info.channel?.name}**.`,
        );
      } else if (type === 'sp_track') {
        const spotify_info = await getSpotifyTrack(url);
        if (!spotify_info) return interaction.editReply('Spotify track not found.');

        const name = spotify_info.name;
        const artists = spotify_info.artists.map(a => a.name).join(', ');

        const position = await enqueue(
          `${name} by ${artists}`,
          `${name} by ${artists}`,
          spotify_info.album.images[0].url,
        );

        await interaction.editReply(
          `Enqueued **${spotify_info.name}** by **${artists}**${
            position > 0 ? ` at position ${position}` : ''
          }.`,
        );
      } else if (type === 'sp_playlist') {
        const spotify_playlist = await getSpotifyPlaylist(url);
        if (!spotify_playlist) return interaction.editReply('Spotify playlist not found.');

        const spotify_infos = [...spotify_playlist.tracks.items];
        for (let i = spotify_infos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = spotify_infos[i];
          spotify_infos[i] = spotify_infos[j];
          spotify_infos[j] = temp;
        }

        let queued = 0;
        for (const spotify_info of spotify_infos) {
          const name = spotify_info.track.name;
          const artists = spotify_info.track.artists.map(a => a.name).join(', ');

          enqueue(
            `${name} by ${artists}`,
            `${name} by ${artists}`,
            spotify_info.track.album.images[0].url,
          );
          queued++;
        }

        await interaction.editReply(
          `Enqueued ${queued} songs from **${spotify_playlist.name}** playlist ` +
            `by **${spotify_playlist.owner.display_name}**.`,
        );
      } else if (type === 'so_track') {
        const soundcloud_info = await getSoundCloudTrack(url);
        if (!soundcloud_info) return interaction.editReply('SoundCloud track not found.');

        const position = await enqueue(
          soundcloud_info.url,
          `${soundcloud_info.title} by ${soundcloud_info.author.name}`,
          soundcloud_info.thumbnail,
        );

        await interaction.editReply(
          `Enqueued **${soundcloud_info.title}** by **${soundcloud_info.author.name}**${
            position > 0 ? ` at position ${position}` : ''
          }.`,
        );
      } else if (type === 'so_playlist') {
        const soundcloud_playlist = await getSoundCloudPlaylist(url);
        if (!soundcloud_playlist) return interaction.editReply('SoundCloud playlist not found.');

        const soundcloud_infos = [...soundcloud_playlist.tracks];
        for (let i = soundcloud_infos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = soundcloud_infos[i];
          soundcloud_infos[i] = soundcloud_infos[j];
          soundcloud_infos[j] = temp;
        }

        for (const soundcloud_info of soundcloud_infos) {
          enqueue(
            soundcloud_info.url,
            `${soundcloud_info.title} by ${soundcloud_info.author.name}`,
            soundcloud_info.thumbnail,
          );
        }

        await interaction.editReply(
          `Enqueued ${soundcloud_playlist.trackCount} songs from **${soundcloud_playlist.title}** playlist ` +
            `by **${soundcloud_playlist.author.name}**.`,
        );
      } else {
        await interaction.editReply('This URL is currently not supported.');
      }
    }
  } catch (error) {
    await interaction.editReply(`Failed to play track due to an error.\n\`\`\`${error}\`\`\``);
  }
}

export async function musicSkip(
  interaction: CommandInteraction | MessageComponentInteraction,
): Promise<unknown> {
  const guild = interaction.guild as Guild;
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;
  const current_voice_channel = guild.me?.voice.channel;
  const subscription = getSubscription(guild.id);

  if (subscription && current_voice_channel?.id !== channel?.id) {
    return interaction.reply({
      content: "You must be on the same channel where I'm currently active to perform this action.",
      ephemeral: true,
    });
  }

  if (!subscription) {
    if (interaction instanceof CommandInteraction) {
      return interaction.reply({
        content: 'Not playing in this server.',
        ephemeral: true,
      });
    } else {
      return interaction.deferUpdate();
    }
  }

  if (interaction instanceof CommandInteraction) {
    const count = interaction.options.getInteger('count', false) ?? 1;
    const skipped = subscription.stop({ skipCount: count });

    await interaction.reply({
      content: `Skipped ${skipped} ${skipped > 1 ? 'songs' : 'song'}.`,
      ephemeral: true,
    });
  } else {
    subscription.stop({ skipCount: 1 });
    await interaction.deferUpdate();
  }
}

export async function musicStop(
  interaction: CommandInteraction | MessageComponentInteraction,
): Promise<unknown> {
  const guild = interaction.guild as Guild;
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;
  const current_voice_channel = guild.me?.voice.channel;
  const subscription = getSubscription(guild.id);

  if (!current_voice_channel || !subscription) {
    if (interaction instanceof CommandInteraction) {
      return interaction.reply({
        content: 'Not playing in this server.',
        ephemeral: true,
      });
    } else {
      return interaction.deferUpdate();
    }
  }

  if (current_voice_channel.id !== channel?.id) {
    return interaction.reply({
      content: "You must be on the same channel where I'm currently active to perform this action.",
      ephemeral: true,
    });
  }

  subscription.stop({ force: true });
  if (interaction instanceof CommandInteraction) {
    await interaction.reply({
      content: 'Playback stopped and all queued music are cleared.',
      ephemeral: true,
    });
  } else {
    await interaction.deferUpdate();
  }
}

export async function musicQueue(
  interaction: CommandInteraction | MessageComponentInteraction,
): Promise<void> {
  const guild = interaction.guild as Guild;
  const subscription = getSubscription(guild.id);

  if (!subscription) {
    if (interaction instanceof CommandInteraction) {
      return interaction.reply({
        content: 'Not playing in this server.',
        ephemeral: true,
      });
    } else {
      return interaction.deferUpdate();
    }
  }

  const current =
    subscription.audioPlayer.state.status === AudioPlayerStatus.Idle
      ? `Nothing is currently playing!`
      : `**Now Playing:**\n${
          (subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title
        }`;

  const queue = subscription.queue
    .slice(0, 10)
    .map((track, index) => `${index + 1}) ${track.title}`)
    .join('\n');

  await interaction.reply({
    content: `${current}\n\n**On Queue: ${subscription.queue.length}**\n${queue}`,
    ephemeral: true,
  });
}

export async function musicPause(
  interaction: CommandInteraction | MessageComponentInteraction,
): Promise<unknown> {
  const guild = interaction.guild as Guild;
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;
  const current_voice_channel = guild.me?.voice.channel;
  const subscription = getSubscription(guild.id);

  if (subscription && current_voice_channel?.id !== channel?.id) {
    return interaction.reply({
      content: "You must be on the same channel where I'm currently active to perform this action.",
      ephemeral: true,
    });
  }

  if (!subscription) {
    if (interaction instanceof CommandInteraction) {
      return interaction.reply({
        content: 'Not playing in this server.',
        ephemeral: true,
      });
    } else {
      return interaction.deferUpdate();
    }
  }

  subscription.audioPlayer.pause();
  if (interaction instanceof CommandInteraction) {
    await interaction.reply({
      content: 'Paused.',
      ephemeral: true,
    });
  } else {
    await interaction.deferUpdate();
  }
}

export async function musicResume(
  interaction: CommandInteraction | MessageComponentInteraction,
): Promise<unknown> {
  const guild = interaction.guild as Guild;
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;
  const current_voice_channel = guild.me?.voice.channel;
  const subscription = getSubscription(guild.id);

  if (subscription && current_voice_channel?.id !== channel?.id) {
    return interaction.reply({
      content: "You must be on the same channel where I'm currently active to perform this action.",
      ephemeral: true,
    });
  }

  if (!subscription) {
    if (interaction instanceof CommandInteraction) {
      return interaction.reply({
        content: 'Not playing in this server.',
        ephemeral: true,
      });
    } else {
      return interaction.deferUpdate();
    }
  }

  subscription.audioPlayer.unpause();
  if (interaction instanceof CommandInteraction) {
    await interaction.reply({
      content: 'Unpaused.',
      ephemeral: true,
    });
  } else {
    await interaction.deferUpdate();
  }
}

export async function musicLeave(
  interaction: CommandInteraction | MessageComponentInteraction,
): Promise<unknown> {
  const guild = interaction.guild as Guild;
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;
  const current_voice_channel = guild.me?.voice.channel;
  const subscription = getSubscription(guild.id);

  if (subscription && current_voice_channel && current_voice_channel?.id !== channel?.id) {
    return interaction.reply({
      content: "You must be on the same channel where I'm currently active to perform this action.",
      ephemeral: true,
    });
  }

  if (!subscription && !current_voice_channel) {
    if (interaction instanceof CommandInteraction) {
      return interaction.reply({
        content: 'Not playing in this server.',
        ephemeral: true,
      });
    } else {
      return interaction.deferUpdate();
    }
  }

  if (subscription) {
    subscription.voiceConnection.destroy();
    deleteSubscription(guild.id);
  } else {
    guild.me?.voice.disconnect();
  }

  await interaction.reply({
    content: 'Disconnected from the channel.',
    ephemeral: true,
  });
}
