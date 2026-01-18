import {
  Colors,
  EmbedBuilder,
  GuildChannel,
  PermissionFlagsBits,
  User,
  VoiceState,
  type BaseMessageOptions,
  type Message,
  type TextBasedChannel,
  type VoiceBasedChannel,
} from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';
import { LavalinkManager } from 'lavalink-client';
import { client } from '../main.js';
import Manager from '../modules/manager.js';
import DatabaseFacade from '../database/database_facade.js';
import EnvironmentFacade from '../environment/environment_facade.js';
import MusicPlayerOperator from './operators/music_player_operator.js';
import Utils from '../misc/utils.js';
import Queuer from '../misc/queuer.js';
import { Constants } from '../misc/constants.js';
import MusicSearchOperator from './operators/music_search_operator.js';
import type { Metadata, TrackWithMetadata, UnresolvedTrackWithMetadata } from './music_defs.js';

export default class MusicManager extends Manager {
  private static _instance: MusicManager;

  private player_operators: Map<string, MusicPlayerOperator>;
  private search_operator: MusicSearchOperator;

  readonly lavalink: LavalinkManager;

  constructor() {
    super();

    this.player_operators = new Map();
    this.search_operator = new MusicSearchOperator(this);

    this.lavalink = new LavalinkManager({
      nodes: [
        {
          authorization: EnvironmentFacade.instance().get('lavalinkAuth'),
          host: EnvironmentFacade.instance().get('lavalinkHost'),
          port: 2333,
          id: 'local',
        },
      ],
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
      autoSkip: true,
    });

    this.lavalink.on('trackStart', (p, t) =>
      this.player_operators.get(p.guildId)?.onTrackStart(p, t as TrackWithMetadata),
    );

    this.lavalink.on('trackStuck', (p, t) =>
      this.player_operators.get(p.guildId)?.onTrackStuck(p, t as TrackWithMetadata),
    );

    this.lavalink.on('trackEnd', (p, t) =>
      this.player_operators.get(p.guildId)?.onTrackEnd(p, t as TrackWithMetadata),
    );

    client.on('voiceStateUpdate', (o, n) => this.onVoiceStateUpdate(o, n));
  }

  static instance() {
    if (!this._instance) {
      this._instance = new MusicManager();
    }

    return this._instance;
  }

  async init() {
    const telemetry = this.telemetry.start(this.init, false);

    telemetry.log(generateDependencyReport());

    if (!client.user) return this.telemetry.error('No user data on init.').end();

    await this.lavalink.init({
      id: client.user.id,
    });

    client.on('raw', d => {
      this.lavalink.sendRawData(d);
    });

    const messageQueuer = new Queuer();
    client.on('messageCreate', m => {
      messageQueuer.queue(() => this.processMessage(m));
    });

    telemetry.end();
  }

  async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const telemetry = this.telemetry.start(this.onVoiceStateUpdate);

    const guild = newState.guild;
    const operator = this.player_operators.get(guild.id);
    if (!operator) return;

    const isMe = newState.id == client.user?.id;

    /**
     * ================================
     * On bot disconnect
     * ================================
     */
    if (isMe && !newState.channelId) {
      telemetry.log('On bot disconnect');

      await operator.player.destroy();
      this.player_operators.delete(guild.id);

      /**
       * ================================
       * On bot channel transfer
       * ================================
       */
    } else if (isMe && oldState.channelId && oldState.channelId != newState.channelId) {
      telemetry.log('On bot channel transfer');

      setTimeout(() => {
        // Check if still the same channel
        if (newState.channelId != operator.voiceChannel?.id) return;

        const voiceChannelSize = operator.voiceChannel?.members.size ?? 0;
        if (voiceChannelSize > 1) return;

        guild.members.me?.voice.disconnect();
      }, 5000);

      /**
       * ================================
       * On member leave on bot's channel
       * ================================
       */
    } else if (
      oldState.channelId != newState.channelId &&
      oldState.channelId == operator.player.voiceChannelId
    ) {
      telemetry.log("On member leave on bot's channel");

      setTimeout(() => {
        const voiceChannelSize = operator.voiceChannel?.members.size ?? 0;
        if (voiceChannelSize > 1) return;

        guild.members.me?.voice.disconnect();
      }, 5000);
    }

    telemetry.end();
  }

  parseTrackData(track: TrackWithMetadata | UnresolvedTrackWithMetadata) {
    const metadata = this.parseMetadata(track.metadata);
    const trackdata = {
      formatTitle: () =>
        track.metadata.title
          ? track.metadata.url
            ? `[${track.metadata.title}](${track.metadata.url})`
            : track.metadata.title
          : track.info.title,
      formatArtist: () =>
        track.metadata.artists
          ? track.metadata.artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', ')
          : (track.info.author ?? '?? No information ??'),
      ...metadata,
    };

    return trackdata;
  }

  parseMetadata(metadata: Metadata) {
    return {
      ...metadata,
      formatPlaylistName: () =>
        metadata.playlist
          ? metadata.playlist.url
            ? `[${metadata.playlist.name}](${metadata.playlist.url})`
            : metadata.playlist.name
          : '',
      formatPlaylistArtist: () =>
        metadata.playlist
          ? metadata.playlist.artists
              .map(a => (a.url ? `[${a.name}](${a.url})` : a.name))
              .join(', ')
          : '',
      formatAlbumName: () =>
        metadata.album
          ? metadata.album.url
            ? `[${metadata.album.name}](${metadata.album.url})`
            : metadata.album.name
          : 'No Album',
      formatAlbumArtist: () =>
        metadata.album
          ? metadata.album.artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', ')
          : 'No Album',
    };
  }

  async processMessage(message: Message) {
    const telemetry = this.telemetry.start(this.processMessage);
    const db = DatabaseFacade.instance();

    if (message.author.bot) return telemetry.log('Ignoring bot message').end();

    const query = message.content.trim();
    if (query.length === 0) return telemetry.log('query').end();

    const guild = message.guild;
    if (!guild) return telemetry.log('guild').end();

    const member = message.member;
    if (!member) return telemetry.log('member').end();

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return telemetry.log('voiceChannel').end();

    const config = await db.musicConfig(guild.id);
    if (!config || !config.enabled || !config.channel) return telemetry.log(config).end();

    const textChannel = guild.channels.cache.get(config.channel);
    if (!textChannel?.isTextBased()) return telemetry.log('textChannel').end();

    if (textChannel.id !== message.channel.id) {
      return telemetry.log('Wrong channel').end();
    }

    const prefix = query.split(' ')[0].toLowerCase();
    if (config.ignored_prefix && Utils.hasAny(prefix, config.ignored_prefix)) {
      return telemetry.log(config.ignored_prefix).end();
    }

    let operator = this.player_operators.get(guild.id);
    if (!operator) {
      const myVoice = guild.members.me?.voice;
      if (myVoice?.channel) await myVoice.disconnect();

      operator = new MusicPlayerOperator(this, voiceChannel, textChannel);
      this.player_operators.set(guild.id, operator);
    }

    const { metadata, tracks } = await this.search_operator.search({
      query,
      player: operator.player,
      user: member.user,
    });

    const embed = new EmbedBuilder({
      description: Constants.MUSIC_QUERY_NO_RESULT,
      color: Colors.Fuchsia,
      footer: { text: Utils.formatReqId(metadata.requestId) },
    });

    console.log(tracks);

    const queuedTracks = await operator.queue(tracks);
    if (queuedTracks > 0) {
      const numOfTracks = `${tracks.length} ${tracks.length > 1 ? `tracks` : 'track'}`;

      let queuedTracks, artist;

      const parsedMetadata = this.parseMetadata(metadata);
      if (parsedMetadata.album) {
        queuedTracks = `${numOfTracks} from ${parsedMetadata.formatAlbumName()} album`;
        artist = parsedMetadata.formatAlbumArtist();
      } else if (parsedMetadata.playlist) {
        queuedTracks = `${numOfTracks} from ${parsedMetadata.formatPlaylistName()} playlist`;
        artist = parsedMetadata.formatPlaylistArtist();
      } else {
        const track = tracks.at(0)!;
        const trackData = this.parseTrackData(track);

        queuedTracks = trackData.formatTitle();
        artist = trackData.formatArtist();
      }

      embed.setDescription(`Enqueued ${queuedTracks} by ${artist}.`).setColor(Colors.Aqua);
    }

    await textChannel.send({ embeds: [embed] });

    telemetry.end();
  }

  private checkChannel(voiceChannel?: VoiceBasedChannel | null): BaseMessageOptions | undefined {
    const messages = [];

    if (!voiceChannel) {
      messages.push(Constants.VOICE_CHANNEL_JOIN);
    } else {
      const me = voiceChannel?.guild.members.me;
      const player = this.lavalink.getPlayer(voiceChannel.guild.id);

      if (player && player.voiceChannelId !== voiceChannel.id) {
        messages.push(Constants.VOICE_CHANNEL_DIFF);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.ViewChannel)) {
        messages.push(Constants.NO_PERM_VIEW_CHANNEL);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.Connect)) {
        messages.push(Constants.NO_PERM_CONNECT);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.Speak)) {
        messages.push(Constants.NO_PERM_SPEAK);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.UseVAD)) {
        messages.push(Constants.NO_PERM_VAD);
      }

      if (voiceChannel.full && !voiceChannel.joinable) {
        messages.push(Constants.VOICE_CHANNEL_FULL);
      }
    }

    if (messages.length === 0) return;

    const embed = new EmbedBuilder({
      description: messages.map(m => `🔸${m}`).join('\n'),
      color: Colors.Fuchsia,
    });

    return { embeds: [embed] };
  }

  async pauseplay(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<BaseMessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const player = this.lavalink.getPlayer(guild.id);
    if (!player || !player.queue.current) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    let result;

    if (player.paused) {
      result = await this.resume(options);
    } else if (player.playing) {
      result = await this.pause(options);
    } else {
      result = {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_PAUSEPLAY_FAILED }],
      };
    }

    return result;
  }

  async pause(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<BaseMessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const operator = this.player_operators.get(guild.id);
    const player = this.lavalink.getPlayer(guild.id);
    if (!operator || !player || !player.connected) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const paused = await operator.pause();
    if (!paused) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_PAUSE_FAILED }],
      };
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} paused the playback.` }],
    };
  }

  async resume(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<BaseMessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const operator = this.player_operators.get(guild.id);
    const player = this.lavalink.getPlayer(guild.id);
    if (!operator || !player) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const resumed = await operator.resume();
    if (!resumed) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_RESUME_FAILED }],
      };
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} resumed the playback.` }],
    };
  }

  async skipTracks(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
    skipCount?: number;
  }): Promise<BaseMessageOptions> {
    if (typeof options.skipCount === 'number' && options.skipCount <= 0) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_SKIPCOUNT_INVALID }],
      };
    }

    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const operator = this.player_operators.get(guild.id);
    const player = this.lavalink.getPlayer(guild.id);
    if (!operator || !player || !player.connected) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const skippedTracks = await operator.skipTracks(options.skipCount);

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

  async stop(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<BaseMessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const operator = this.player_operators.get(guild.id);
    const player = this.lavalink.getPlayer(guild.id);
    if (!operator || !player || !player.connected) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const removedTracks = await operator.stop();

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

  async list(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<BaseMessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const operator = this.player_operators.get(guild.id);
    const player = this.lavalink.getPlayer(guild.id);
    if (!operator || !player || !player.connected) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const currentTrack = player.queue.current;
    if (!currentTrack && player.queue.tracks.length === 0) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_IDLE }],
      };
    }

    let trackCount = 0;
    const queuedTracks = player.queue.tracks.map(t => {
      const trackData = this.parseTrackData(t as TrackWithMetadata);

      return `**${++trackCount}.** ${trackData.formatTitle()} by ${trackData.formatArtist()}`;
    });

    const currentTrackData = this.parseTrackData(currentTrack as TrackWithMetadata);

    let description = `**Now Playing**:\n${currentTrackData.formatTitle()} by ${currentTrackData.formatArtist()}`;
    if (queuedTracks.length > 0) {
      description += ['\n', `**On Queue: ${trackCount - 1}**`, ...queuedTracks].join('\n');
    }

    const embed = new EmbedBuilder({
      author: { name: 'Parallax Music Player: Music List' },
      description: description,
      color: Colors.Aqua,
    });

    return { embeds: [embed] };
  }

  async disconnect(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<BaseMessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const operator = this.player_operators.get(guild.id);
    const player = this.lavalink.getPlayer(guild.id);
    if (!operator || !player || !player.connected) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    await guild.members.me?.voice.disconnect();

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} turned off the player.` }],
    };
  }
}
