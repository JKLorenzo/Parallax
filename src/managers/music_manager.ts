import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import {
  Collection,
  GuildChannel,
  PermissionFlagsBits,
  TextBasedChannel,
  User,
  VoiceBasedChannel,
  VoiceState,
} from 'discord.js';
import playdl from 'play-dl';
import type Bot from '../modules/bot.js';
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
  }

  private onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const guildId = newState.guild.id;
    const subscription = this.subscriptions.get(guildId);
    subscription?.onVoiceStateUpdate(oldState, newState);
  }

  private async queryLookup(options: {
    query: string;
    channel: TextBasedChannel;
    subscription: Subscription;
  }): Promise<QueryLookupResult> {
    const result: QueryLookupResult = {
      info: constants.MUSIC_QUERY_NO_RESULT,
      tracks: [] as Track[],
    };
    const queryType = await playdl.validate(options.query);

    if (playdl.is_expired()) {
      await playdl.refreshToken();
      console.log('Token Refreshed');
    }

    if (queryType === 'search') {
      if (options.query.toLowerCase().startsWith('dz ')) {
        const data = await playdl.search(options.query, { limit: 1, source: { deezer: 'track' } });

        if (data.length > 0) {
          const title = `${data[0].title} by ${data[0].artist.name}`;
          const track = new Track(title, {
            channel: options.channel,
            subscription: options.subscription,
            imageUrl: data[0].album.cover.medium,
          });

          result.info = `Enqueued ${title}.`;
          result.tracks.push(track);
        }
      } else if (options.query.toLowerCase().startsWith('sc ')) {
        const data = await playdl.search(options.query, {
          limit: 1,
          source: { soundcloud: 'tracks' },
        });

        if (data.length > 0) {
          const title = `${data[0].name} by ${data[0].user.name}`;
          const track = new Track(title, {
            channel: options.channel,
            subscription: options.subscription,
            audioUrl: data[0].url,
            imageUrl: data[0].thumbnail,
          });

          result.info = `Enqueued ${title}.`;
          result.tracks.push(track);
        }
      } else if (options.query.toLowerCase().startsWith('sp ')) {
        const data = await playdl.search(options.query, { limit: 1, source: { spotify: 'track' } });

        if (data.length > 0) {
          const title = `${data[0].name} by ${data[0].artists.map(e => e.name).join(', ')}`;
          const track = new Track(title, {
            channel: options.channel,
            subscription: options.subscription,
            imageUrl: data[0].thumbnail?.url,
          });

          result.info = `Enqueued ${title}.`;
          result.tracks.push(track);
        }
      } else {
        const data = await playdl.search(options.query, { limit: 1, source: { youtube: 'video' } });

        if (data.length > 0) {
          const title = `${data[0].title} by ${data[0].channel?.name}`;
          const track = new Track(title, {
            channel: options.channel,
            subscription: options.subscription,
            audioUrl: data[0].url,
            imageUrl: data[0].thumbnails[0]?.url,
          });

          result.info = `Enqueued ${title}.`;
          result.tracks.push(track);
        }
      }
    } else if (queryType === 'dz_album') {
      const data = (await playdl.deezer(options.query)) as playdl.DeezerAlbum;
      const all_tracks = await data.all_tracks();
      const tracks = all_tracks.map(e => {
        const title = `${e.title} by ${e.artist.name}`;
        return new Track(title, {
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.album.cover.medium,
        });
      });

      result.info = `Enqueued ${tracks.length} tracks from ${data.title} album by ${data.artist.name}.`;
      result.tracks.push(...tracks);
    } else if (queryType === 'dz_playlist') {
      const data = (await playdl.deezer(options.query)) as playdl.DeezerPlaylist;
      const all_tracks = await data.all_tracks();
      const tracks = all_tracks.map(e => {
        const title = `${e.title} by ${e.artist.name}`;
        return new Track(title, {
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.album.cover.medium,
        });
      });

      result.info = `Enqueued ${tracks.length} tracks from ${data.title} playlist by ${data.creator.name}.`;
      result.tracks.push(...tracks);
    } else if (queryType === 'dz_track') {
      const data = (await playdl.deezer(options.query)) as playdl.DeezerTrack;
      await data.fetch();
      const title = `${data.title} by ${data.artist.name}`;
      const track = new Track(title, {
        channel: options.channel,
        subscription: options.subscription,
        imageUrl: data.album.cover.medium,
      });

      result.info = `Enqueued ${title}.`;
      result.tracks.push(track);
    } else if (queryType === 'so_playlist') {
      const data = (await playdl.soundcloud(options.query)) as playdl.SoundCloudPlaylist;
      const all_tracks = await data.all_tracks();
      const tracks = all_tracks.map(e => {
        const title = `${e.name} by ${e.user.name}`;
        return new Track(title, {
          channel: options.channel,
          subscription: options.subscription,
          audioUrl: e.url,
          imageUrl: e.thumbnail,
        });
      });

      result.info = `Enqueued ${tracks.length} tracks from ${data.name} playlist by ${data.user.name}.`;
      result.tracks.push(...tracks);
    } else if (queryType === 'so_track') {
      const data = (await playdl.soundcloud(options.query)) as playdl.SoundCloudTrack;
      const title = `${data.name} by ${data.user.name}`;
      const track = new Track(title, {
        channel: options.channel,
        subscription: options.subscription,
        audioUrl: data.url,
        imageUrl: data.thumbnail,
      });

      result.info = `Enqueued ${title}.`;
      result.tracks.push(track);
    } else if (queryType === 'sp_album') {
      const data = (await playdl.spotify(options.query)) as playdl.SpotifyAlbum;
      const all_tracks = await data.all_tracks();
      const tracks = all_tracks.map(e => {
        const title = `${e.name} by ${e.artists.map(a => a.name).join(', ')}`;
        return new Track(title, {
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.thumbnail?.url,
        });
      });

      result.info = `Enqueued ${tracks.length} tracks from ${data.name} album by ${data.artists
        .map(e => e.name)
        .join(', ')}.`;
      result.tracks.push(...tracks);
    } else if (queryType === 'sp_playlist') {
      const data = (await playdl.spotify(options.query)) as playdl.SpotifyPlaylist;
      const all_tracks = await data.all_tracks();
      const tracks = all_tracks.map(e => {
        const title = `${e.name} by ${e.artists.map(a => a.name).join(', ')}`;
        return new Track(title, {
          channel: options.channel,
          subscription: options.subscription,
          imageUrl: e.thumbnail?.url,
        });
      });

      result.info = `Enqueued ${tracks.length} tracks from ${data.name} playlist by ${data.owner.name}.`;
      result.tracks.push(...tracks);
    } else if (queryType === 'sp_track') {
      const data = (await playdl.spotify(options.query)) as playdl.SpotifyTrack;
      const title = `${data.name} by ${data.artists.map(e => e.name).join(', ')}`;
      const track = new Track(title, {
        channel: options.channel,
        subscription: options.subscription,
        imageUrl: data.thumbnail?.url,
      });

      result.info = `Enqueued ${title}.`;
      result.tracks.push(track);
    } else if (queryType === 'yt_playlist') {
      const data = await playdl.playlist_info(options.query);
      const all_tracks = await data.all_videos();
      const tracks = all_tracks.map(e => {
        const title = `${e.title} by ${e.channel?.name}`;
        return new Track(title, {
          channel: options.channel,
          subscription: options.subscription,
          audioUrl: e.url,
          imageUrl: e.thumbnails[0]?.url,
        });
      });

      result.info = `Enqueued ${tracks.length} tracks from ${
        data.title ?? 'No Title'
      } playlist by ${data.channel?.name ?? 'No Name'}.`;
      result.tracks.push(...tracks);
    } else if (queryType === 'yt_video') {
      const data = await playdl.video_info(options.query);
      const title = `${data.video_details.title} by ${data.video_details.channel?.name}`;
      const track = new Track(title, {
        channel: options.channel,
        subscription: options.subscription,
        audioUrl: data.video_details.url,
        imageUrl: data.video_details.thumbnails[0]?.url,
      });

      result.info = `Enqueued ${title}.`;
      result.tracks.push(track);
    }

    return result;
  }

  private checkChannel(voiceChannel?: VoiceBasedChannel | null) {
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

    return messages.map(m => `🔸${m}`).join('\n');
  }

  async play(options: { user: User; textChannel: TextBasedChannel; query?: string }) {
    if (this.disabled) return constants.MUSIC_DISABLED;
    if (!options.query?.length) return constants.MUSIC_QUERY_EMPTY;

    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    let subscription = this.subscriptions.get(guild.id);

    if (!subscription) {
      subscription = new Subscription({ bot: this.bot, voiceChannel });

      // Join voice channel
      try {
        await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 10000);
      } catch (_) {
        return constants.MUSIC_JOIN_CHANNEL_FAILED;
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

  skip(options: { user: User; textChannel?: TextBasedChannel | null; skipCount?: number | null }) {
    if (typeof options.skipCount === 'number' && options.skipCount <= 0) {
      return constants.MUSIC_SKIPCOUNT_INVALID;
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

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) return constants.MUSIC_NOT_ACTIVE;

    const skippedTracks = subscription.stop({ skipCount: options.skipCount ?? 1 });

    return `${member.toString()} skipped ${skippedTracks} track${
      skippedTracks > 1 ? 's' : ''
    } from the queue.`;
  }

  stop(options: { user: User; textChannel?: TextBasedChannel | null }) {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) return constants.MUSIC_NOT_ACTIVE;

    const removedTracks = subscription.stop() ?? 0;

    return `${member.toString()} stopped the playback and ${removedTracks} track${
      removedTracks > 1 ? 's were' : ' was'
    } removed from the queue.`;
  }

  pause(options: { user: User; textChannel?: TextBasedChannel | null }) {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) return constants.MUSIC_NOT_ACTIVE;

    const paused = subscription.audioPlayer.pause();
    if (!paused) return constants.MUSIC_PLAYER_PAUSE_FAILED;

    return `${member} paused the playback.`;
  }

  resume(options: { user: User; textChannel?: TextBasedChannel | null }) {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) return constants.MUSIC_NOT_ACTIVE;

    const resumed = subscription.audioPlayer.unpause();
    if (!resumed) return constants.MUSIC_PLAYER_RESUME_FAILED;

    return `${member} resumed the playback.`;
  }

  pauseplay(options: { user: User; textChannel?: TextBasedChannel | null }) {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) return constants.MUSIC_NOT_ACTIVE;

    let result: string;

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
        result = constants.MUSIC_PLAYER_PAUSEPLAY_FAILED;
      }
    }

    return result;
  }

  list(options: { user: User; textChannel?: TextBasedChannel | null }) {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) return constants.MUSIC_NOT_ACTIVE;

    if (subscription.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      return constants.MUSIC_PLAYER_IDLE;
    }

    const resource = subscription.audioPlayer.state.resource as AudioResource<Track>;
    const list = subscription.tracks
      .slice(0, 10)
      .map((track, index) => `${index + 1}) ${track.title}`)
      .join('\n');

    return `**Now Playing:**\n${resource.metadata.title}\n\n**On Queue: ${subscription.tracks.length}**\n${list}`;
  }

  async disconnect(options: { user: User; textChannel?: TextBasedChannel | null }) {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult.length > 0) {
      return checkResult;
    }

    const subscription = this.subscriptions.get(guild.id);

    if (subscription) {
      await subscription.terminate();
    } else {
      guild.members.me?.voice.disconnect();
    }

    return `${member} turned off the player.`;
  }
}
