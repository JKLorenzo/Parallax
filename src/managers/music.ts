import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import {
  CommandInteraction,
  Guild,
  GuildMember,
  MessageComponentInteraction,
  Snowflake,
  TextChannel,
} from 'discord.js';
import fetch from 'node-fetch';
import {
  getSoundCloudPlaylist,
  getSoundCloudTrack,
  searchSoundCloud,
} from '../modules/soundcloud.js';
import { getSpotifyPlaylist, getSpotifyTrack } from '../modules/spotify.js';
import { getYouTubeInfo, searchYouTube } from '../modules/youtube.js';
import Subscription from '../structures/subscription.js';
import Track from '../structures/track.js';
import { hasAny, parseHTML } from '../utils/functions.js';

const _subscriptions = new Map<Snowflake, Subscription>();

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
        adapterCreator: guild.voiceAdapterCreator,
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
    const enqueue = (query: string, title?: string, image?: string): Track =>
      subscription!.enqueue(interaction.channel as TextChannel, query, title, image);

    if (hasAny(song, 'http')) {
      if (hasAny(song, 'youtube.com')) {
        const info = await getYouTubeInfo(song);
        if (!info) return interaction.editReply('Track not found.');

        const title = parseHTML(info.videoDetails.title).trim();
        const author = parseHTML(info.videoDetails.author.name).trim();

        await enqueue(song, `${title} by ${author}`, info.thumbnail_url);
        await interaction.followUp(`Enqueued **${title}** by **${author}**.`);
      } else if (hasAny(song, 'spotify.com')) {
        if (hasAny(song, '/playlist')) {
          const playlist = await getSpotifyPlaylist(song);
          if (!playlist) return interaction.editReply('Playlist not found.');

          for (const item of playlist.tracks.items) {
            const title = parseHTML(item.track.name).trim();
            const author = parseHTML(item.track.artists.map(a => a.name).join(', ')).trim();

            await enqueue(
              `${title} ${author}`,
              `${title} by ${author}`,
              item.track.album.images[0]?.url,
            );
          }

          const title = parseHTML(playlist.name).trim();
          const author = parseHTML(playlist.owner.display_name ?? '').trim();

          await interaction.followUp(
            `Enqueued ${playlist.tracks.items.length} songs from ` +
              `**${title}** playlist${author ? ` by **${author}**` : ''}.`,
          );
        } else if (hasAny(song, '/track')) {
          const track = await getSpotifyTrack(song);
          if (!track) return interaction.editReply('Track not found.');

          const title = parseHTML(track.name).trim();
          const author = parseHTML(track.artists.map(a => a.name).join(', ')).trim();

          await enqueue(`${title} ${author}`, `${title} by ${author}`, track.album.images[0]?.url);
          await interaction.followUp(`Enqueued **${title}** by **${author}**.`);
        } else {
          return interaction.editReply('This link is currently not supported.');
        }
      } else if (hasAny(song, 'soundcloud')) {
        const response = await fetch(song);
        if (hasAny(response.url, '/sets/')) {
          const playlist = await getSoundCloudPlaylist(response.url);
          if (!playlist) return interaction.editReply('No match found, please try again.');

          for (const item of playlist.tracks) {
            const title = parseHTML(item.title).trim();
            const author = parseHTML(item.author.name).trim();

            await enqueue(item.url, `${title} by ${author}`, item.thumbnail);
          }

          const title = parseHTML(playlist.title).trim();
          const author = parseHTML(playlist.author.name).trim();

          await interaction.followUp(
            `Enqueued ${playlist.trackCount} songs from **${title}** playlist by **${author}**.`,
          );
        } else {
          const data = await getSoundCloudTrack(response.url);
          if (!data) return interaction.editReply('No match found, please try again.');

          const title = parseHTML(data.title).trim();
          const author = parseHTML(data.author.name).trim();

          await enqueue(response.url, `${title} by ${author}`, data.thumbnail);
          await interaction.followUp(`Enqueued **${title}** by **${author}**.`);
        }
      } else {
        await interaction.editReply('This link is currently not supported.');
      }
    } else if (hasAny(song.toLowerCase(), 'soundcloud')) {
      const data = await searchSoundCloud(song);
      if (!data) return interaction.editReply('No match found, please try again.');

      const title = parseHTML(data.name).trim();
      const author = parseHTML(data.artist).trim();

      await enqueue(data.url, `${title} by ${author}`);
      await interaction.followUp(`Enqueued **${title}** by **${author}**.`);
    } else {
      const data = await searchYouTube(song);
      if (!data) return interaction.editReply('No match found, please try again.');

      const title = parseHTML(data.title).trim();
      const author = parseHTML(data.channelTitle).trim();

      await enqueue(data.link, `${title} by ${author}`, data.thumbnails.default?.url);
      await interaction.followUp(`Enqueued **${title}** by **${author}**.`);
    }
  } catch (error) {
    console.warn(error);
    await interaction.editReply('Failed to play track, please try again later.');
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

  subscription.stop({ force: true });
  if (interaction instanceof CommandInteraction) {
    await interaction.reply({
      content: 'Stopped all songs.',
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
