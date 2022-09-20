import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import {
  Collection,
  Colors,
  EmbedBuilder,
  GuildChannel,
  Message,
  MessageOptions,
  PermissionFlagsBits,
  TextBasedChannel,
  User,
  VoiceBasedChannel,
  VoiceState,
} from 'discord.js';
import playdl from 'play-dl';
import type Bot from '../modules/bot.js';
import AlbumInfo from '../modules/info_album.js';
import PlaylistInfo from '../modules/info_playlist.js';
import TrackInfo from '../modules/info_track.js';
import Subscription from '../modules/subscription.js';
import Track from '../modules/track.js';
import Utils from '../modules/utils.js';
import type { QueryLookupResult } from '../schemas/types.js';
import Manager from '../structures/manager.js';

const { constants } = new Utils();

export default class MusicManager extends Manager {
  disabled: boolean;
  subscriptions: Collection<string, Subscription>;

  constructor(bot: Bot) {
    super(bot);

    this.disabled = false;
    this.subscriptions = new Collection();
  }

  async init() {
    const { environment } = this.bot.managers;

    await playdl.setToken({
      soundcloud: {
        client_id: environment.get('soundcloudId'),
      },
      spotify: {
        market: 'PH',
        client_id: environment.get('spotifyId'),
        client_secret: environment.get('spotifySecret'),
        refresh_token: environment.get('spotifyRefresh'),
      },
      useragent: [environment.get('userAgent')],
    });

    this.bot.client.on('voiceStateUpdate', (oldState, newState) => {
      this.onVoiceStateUpdate(oldState, newState);
    });

    this.bot.client.on('messageCreate', message => {
      this.onMessageCreate(message);
    });
  }

  private onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const guildId = newState.guild.id;
    const subscription = this.subscriptions.get(guildId);
    subscription?.onVoiceStateUpdate(oldState, newState);
  }

  private async onMessageCreate(message: Message<boolean>) {
    const { database } = this.bot.managers;

    if (message.author.bot) return;

    const guild = message.guild;
    if (!guild) return;

    const config = await database.musicConfig(guild.id);
    if (!config?.enabled || message.channelId !== config.channel) return;

    const query = message.content;
    const textChannel = message.channel;

    // Check if message is a command for other bots
    const response = await Promise.race([
      textChannel.awaitMessages({
        filter: msg => msg.author.id !== this.bot.client.user?.id,
        max: 1,
        time: 2000,
      }),
      message.awaitReactions({
        filter: reac => reac.users.cache.some(u => u.bot),
        max: 1,
        time: 2000,
      }),
    ]);
    if (response.first()) return;

    const user = message.member?.user;
    if (!user) return;

    const result = await this.play({ user, textChannel, query });

    await message.reply(result);
  }

  private async queryLookup(options: {
    query: string;
    channel: TextBasedChannel;
    subscription: Subscription;
  }): Promise<QueryLookupResult> {
    const result: Track[] = [];
    const embed = new EmbedBuilder({
      description: constants.MUSIC_QUERY_NO_RESULT,
      color: Colors.Fuchsia,
    });
    const queryType = await playdl.validate(options.query);

    if (playdl.is_expired()) {
      const tokenTelemetry = this.bot.managers.telemetry.node(this, 'PlayDL Token Refresh');
      try {
        await playdl.refreshToken();
        tokenTelemetry.logMessage('Token refreshed successfully.');
      } catch (error) {
        tokenTelemetry.logError(error);
      }
    }

    if (queryType === 'search') {
      if (options.query.toLowerCase().startsWith('dz ')) {
        const data = await playdl.search(options.query, { limit: 1, source: { deezer: 'track' } });

        if (data.length > 0) {
          const info = new TrackInfo({
            track: { name: data[0].title, url: data[0].url },
            artists: [{ name: data[0].artist.name, url: data[0].artist.url }],
          });

          const track = new Track({
            info,
            channel: options.channel,
            subscription: options.subscription,
            imageUrl: data[0].album.cover.medium,
          });

          embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
          result.push(track);
        }
      } else if (options.query.toLowerCase().startsWith('sc ')) {
        const data = await playdl.search(options.query, {
          limit: 1,
          source: { soundcloud: 'tracks' },
        });

        if (data.length > 0) {
          const info = new TrackInfo({
            track: { name: data[0].name, url: data[0].url },
            artists: [{ name: data[0].user.name, url: data[0].user.url }],
          });

          const track = new Track({
            info,
            channel: options.channel,
            subscription: options.subscription,
            audioUrl: data[0].url,
            imageUrl: data[0].thumbnail,
          });

          embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
          result.push(track);
        }
      } else if (options.query.toLowerCase().startsWith('sp ')) {
        const data = await playdl.search(options.query, { limit: 1, source: { spotify: 'track' } });

        if (data.length > 0) {
          const info = new TrackInfo({
            track: { name: data[0].name, url: data[0].url },
            artists: data[0].artists.map(e => ({ name: e.name, url: e.url })),
          });

          const track = new Track({
            info,
            channel: options.channel,
            subscription: options.subscription,
            imageUrl: data[0].thumbnail?.url,
          });

          embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
          result.push(track);
        }
      } else {
        const data = await playdl.search(options.query, { limit: 1, source: { youtube: 'video' } });

        if (data.length > 0) {
          const info = new TrackInfo({
            track: { name: data[0].title ?? 'Unknown Title', url: data[0].url },
            artists: [
              { name: data[0].channel?.name ?? 'Unknown Channel', url: data[0].channel?.url },
            ],
          });

          const track = new Track({
            info,
            channel: options.channel,
            subscription: options.subscription,
            audioUrl: data[0].url,
            imageUrl: data[0].thumbnails[0]?.url,
          });

          embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
          result.push(track);
        }
      }
    } else if (queryType === 'dz_album') {
      const data = (await playdl.deezer(options.query)) as playdl.DeezerAlbum;
      const all_tracks = await data.all_tracks();

      const album = new AlbumInfo({
        track: { name: data.title, url: data.url },
        artists: [{ name: data.artist.name, url: data.artist.url }],
      });

      const tracks = all_tracks.map(e => {
        const info = new TrackInfo({
          track: { name: e.title, url: e.url },
          artists: [{ name: e.artist.name, url: e.artist.url }],
        });

        return new Track({
          info,
          album,
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.album.cover.medium,
        });
      });

      embed
        .setColor(Colors.Aqua)
        .setDescription(`Enqueued **${tracks.length}** tracks from ${album.toFormattedString()}.`);
      result.push(...tracks);
    } else if (queryType === 'dz_playlist') {
      const data = (await playdl.deezer(options.query)) as playdl.DeezerPlaylist;
      const all_tracks = await data.all_tracks();

      const playlist = new PlaylistInfo({
        track: { name: data.title, url: data.url },
        artists: [{ name: data.creator.name }],
      });

      const tracks = all_tracks.map(e => {
        const info = new TrackInfo({
          track: { name: e.title, url: e.url },
          artists: [{ name: e.artist.name, url: e.artist.url }],
        });

        return new Track({
          info,
          playlist,
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.album.cover.medium,
        });
      });

      embed
        .setColor(Colors.Aqua)
        .setDescription(
          `Enqueued **${tracks.length}** tracks from ${playlist.toFormattedString()}.`,
        );
      result.push(...tracks);
    } else if (queryType === 'dz_track') {
      const data = (await playdl.deezer(options.query)) as playdl.DeezerTrack;
      await data.fetch();

      const info = new TrackInfo({
        track: { name: data.title, url: data.url },
        artists: [{ name: data.artist.name, url: data.artist.url }],
      });

      const track = new Track({
        info,
        channel: options.channel,
        subscription: options.subscription,
        imageUrl: data.album.cover.medium,
      });

      embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
      result.push(track);
    } else if (queryType === 'so_playlist') {
      const data = (await playdl.soundcloud(options.query)) as playdl.SoundCloudPlaylist;
      const all_tracks = await data.all_tracks();

      const playlist = new PlaylistInfo({
        track: { name: data.name, url: data.url },
        artists: [{ name: data.user.name, url: data.user.url }],
      });

      const tracks = all_tracks.map(e => {
        const info = new TrackInfo({
          track: { name: e.name, url: e.url },
          artists: [{ name: e.user.name, url: e.user.url }],
        });

        return new Track({
          info,
          playlist,
          channel: options.channel,
          subscription: options.subscription,
          audioUrl: e.url,
          imageUrl: e.thumbnail,
        });
      });

      embed
        .setColor(Colors.Aqua)
        .setDescription(
          `Enqueued **${tracks.length}** tracks from *${playlist.toFormattedString()}.`,
        );
      result.push(...tracks);
    } else if (queryType === 'so_track') {
      const data = (await playdl.soundcloud(options.query)) as playdl.SoundCloudTrack;

      const info = new TrackInfo({
        track: { name: data.name, url: data.url },
        artists: [{ name: data.user.name, url: data.user.url }],
      });

      const track = new Track({
        info,
        channel: options.channel,
        subscription: options.subscription,
        audioUrl: data.url,
        imageUrl: data.thumbnail,
      });

      embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
      result.push(track);
    } else if (queryType === 'sp_album') {
      const data = (await playdl.spotify(options.query)) as playdl.SpotifyAlbum;
      const all_tracks = await data.all_tracks();

      const album = new AlbumInfo({
        track: { name: data.name, url: data.url },
        artists: data.artists.map(a => ({ name: a.name, url: a.url })),
      });

      const tracks = all_tracks.map(e => {
        const info = new TrackInfo({
          track: { name: e.name, url: e.url },
          artists: e.artists.map(a => ({ name: a.name, url: a.url })),
        });

        return new Track({
          info,
          album,
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.thumbnail?.url,
        });
      });

      embed
        .setColor(Colors.Aqua)
        .setDescription(`Enqueued **${tracks.length}** tracks from ${album.toFormattedString()}.`);
      result.push(...tracks);
    } else if (queryType === 'sp_playlist') {
      const data = (await playdl.spotify(options.query)) as playdl.SpotifyPlaylist;
      const all_tracks = await data.all_tracks();

      const playlist = new PlaylistInfo({
        track: { name: data.name, url: data.url },
        artists: [{ name: data.owner.name, url: data.owner.url }],
      });

      const tracks = all_tracks.map(e => {
        const info = new TrackInfo({
          track: { name: e.name, url: e.url },
          artists: e.artists.map(a => ({ name: a.name, url: a.url })),
        });

        return new Track({
          info,
          playlist,
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.thumbnail?.url,
        });
      });

      embed
        .setColor(Colors.Aqua)
        .setDescription(
          `Enqueued **${tracks.length}** tracks from ${playlist.toFormattedString()}.`,
        );
      result.push(...tracks);
    } else if (queryType === 'sp_track') {
      const data = (await playdl.spotify(options.query)) as playdl.SpotifyTrack;

      const info = new TrackInfo({
        track: { name: data.name, url: data.url },
        artists: data.artists.map(e => ({ name: e.name, url: e.url })),
      });

      const track = new Track({
        info,
        channel: options.channel,
        subscription: options.subscription,
        imageUrl: data.thumbnail?.url,
      });

      embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
      result.push(track);
    } else if (queryType === 'yt_playlist') {
      const data = await playdl.playlist_info(options.query);
      const all_tracks = await data.all_videos();

      const playlist = new PlaylistInfo({
        track: { name: data.title ?? 'Unknown Playlist', url: data.url },
        artists: [{ name: data.channel?.name ?? 'Unknown Channel', url: data.channel?.url }],
      });

      const tracks = all_tracks.map(e => {
        const info = new TrackInfo({
          track: { name: e.title ?? 'Unknown Title', url: e.url },
          artists: [{ name: e.channel?.name ?? 'Unknown Artist', url: e.channel?.url }],
        });

        return new Track({
          info,
          playlist,
          channel: options.channel,
          subscription: options.subscription,
          audioUrl: e.url,
          imageUrl: e.thumbnails[0]?.url,
        });
      });

      embed
        .setColor(Colors.Aqua)
        .setDescription(
          `Enqueued **${tracks.length}** tracks from ${playlist.toFormattedString()}.`,
        );
      result.push(...tracks);
    } else if (queryType === 'yt_video') {
      const data = await playdl.video_info(options.query);

      const info = new TrackInfo({
        track: { name: data.video_details.title ?? 'Unknown Title', url: data.video_details.url },
        artists: [
          {
            name: data.video_details.channel?.name ?? 'Unknown Channel',
            url: data.video_details.channel?.url,
          },
        ],
      });

      const track = new Track({
        info,
        channel: options.channel,
        subscription: options.subscription,
        audioUrl: data.video_details.url,
        imageUrl: data.video_details.thumbnails[0]?.url,
      });

      embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);
      result.push(track);
    }

    return { tracks: result, info: { embeds: [embed] } };
  }

  private checkChannel(voiceChannel?: VoiceBasedChannel | null): MessageOptions | undefined {
    const messages = [];

    if (!voiceChannel) {
      messages.push(constants.VOICE_CHANNEL_JOIN);
    } else {
      const me = voiceChannel?.guild.members.me;
      const subscription = this.subscriptions.get(voiceChannel.guild.id);

      if (subscription && subscription.voiceChannel?.id !== voiceChannel.id) {
        messages.push(constants.VOICE_CHANNEL_DIFF);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.ViewChannel)) {
        messages.push(constants.NO_PERM_VIEW_CHANNEL);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.Connect)) {
        messages.push(constants.NO_PERM_CONNECT);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.Speak)) {
        messages.push(constants.NO_PERM_SPEAK);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.UseVAD)) {
        messages.push(constants.NO_PERM_VAD);
      }

      if (voiceChannel.full && !voiceChannel.joinable) {
        messages.push(constants.VOICE_CHANNEL_FULL);
      }
    }

    if (messages.length === 0) return;

    const embed = new EmbedBuilder({
      description: messages.map(m => `🔸${m}`).join('\n'),
      color: Colors.Fuchsia,
    });

    return { embeds: [embed] };
  }

  async play(options: {
    user: User;
    textChannel: TextBasedChannel;
    query?: string;
  }): Promise<MessageOptions> {
    if (this.disabled) {
      return { embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_DISABLED }] };
    }

    if (!options.query?.length) {
      return { embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_QUERY_EMPTY }] };
    }

    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    let subscription = this.subscriptions.get(guild.id);

    if (!subscription) {
      subscription = new Subscription({ bot: this.bot, voiceChannel });

      // Join voice channel
      try {
        await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 10000);
      } catch (_) {
        return {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_JOIN_CHANNEL_FAILED }],
        };
      }

      // Update subscriptions
      this.subscriptions.set(guild.id, subscription);
    }

    const data = await this.queryLookup({
      query: options.query,
      channel: options.textChannel,
      subscription,
    });

    subscription.queue(data.tracks);

    return data.info;
  }

  skip(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
    skipCount?: number | null;
  }): MessageOptions {
    if (typeof options.skipCount === 'number' && options.skipCount <= 0) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_SKIPCOUNT_INVALID }],
      };
    }

    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const skippedTracks = subscription.stop({ skipCount: options.skipCount ?? 1 });

    return {
      embeds: [
        {
          color: Colors.Aqua,
          description: `${member.toString()} skipped ${skippedTracks} track${
            skippedTracks > 1 ? 's' : ''
          } from the queue.`,
        },
      ],
    };
  }

  stop(options: { user: User; textChannel?: TextBasedChannel | null }): MessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const removedTracks = subscription.stop() ?? 0;

    return {
      embeds: [
        {
          color: Colors.Aqua,
          description: `${member.toString()} stopped the playback and **${removedTracks}** track${
            removedTracks > 1 ? 's were' : ' was'
          } removed from the queue.`,
        },
      ],
    };
  }

  pause(options: { user: User; textChannel?: TextBasedChannel | null }): MessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const paused = subscription.audioPlayer.pause();
    if (!paused) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_PLAYER_PAUSE_FAILED }],
      };
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} paused the playback.` }],
    };
  }

  resume(options: { user: User; textChannel?: TextBasedChannel | null }): MessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const resumed = subscription.audioPlayer.unpause();
    if (!resumed) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_PLAYER_RESUME_FAILED }],
      };
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} resumed the playback.` }],
    };
  }

  pauseplay(options: { user: User; textChannel?: TextBasedChannel | null }): MessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_NOT_ACTIVE }],
      };
    }

    let result;

    switch (subscription.audioPlayer.state.status) {
      case AudioPlayerStatus.Paused: {
        result = this.resume(options);
        break;
      }
      case AudioPlayerStatus.Playing: {
        result = this.pause(options);
        break;
      }
      default: {
        result = {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_PLAYER_PAUSEPLAY_FAILED }],
        };
      }
    }

    return result;
  }

  list(options: { user: User; textChannel?: TextBasedChannel | null }): MessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_NOT_ACTIVE }],
      };
    }

    if (subscription.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_PLAYER_IDLE }],
      };
    }

    const resource = subscription.audioPlayer.state.resource as AudioResource<Track>;

    const nowPlaying = resource.metadata.info.toFormattedString();
    const onQueue = subscription.tracks
      .slice(0, 10)
      .map((t, i) => `${i + 1}) ${t.info.toFormattedString()}`)
      .join('\n');

    let formatted = `**Now Playing**:\n${nowPlaying}`;
    if (onQueue) formatted += `\n\n**On Queue: ${subscription.tracks.length}**\n${onQueue}`;

    const embed = new EmbedBuilder({
      author: { name: 'Parallax Music Player: Music List' },
      description: formatted,
      color: Colors.Aqua,
    });

    return { embeds: [embed] };
  }

  async disconnect(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<MessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);

    if (subscription) {
      await subscription.terminate();
    } else {
      guild.members.me?.voice.disconnect();
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} turned off the player.` }],
    };
  }
}
