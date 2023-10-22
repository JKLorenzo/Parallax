import {
  entersState,
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayer,
  type AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  VoiceConnection,
  type VoiceConnectionState,
  VoiceConnectionStatus,
  VoiceConnectionDisconnectReason,
} from '@discordjs/voice';
import type { Guild, VoiceBasedChannel, VoiceState } from 'discord.js';
import type MusicHandler from './music_handler.js';
import type MusicManager from './music_manager.js';
import type MusicTrack from './music_track.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import type Bot from '../../modules/bot.js';
import Queuer from '../../modules/queuer.js';
import Utils from '../../static/utils.js';

export default class MusicSubscription extends Telemetry {
  private readyLock: boolean;
  private queuer: Queuer;
  private processQueuer: Queuer;

  readonly bot: Bot;
  handlers: MusicHandler[];
  readonly guild: Guild;
  readonly manager: MusicManager;
  readonly audioPlayer: AudioPlayer;
  readonly voiceConnection: VoiceConnection;

  constructor(options: { bot: Bot; voiceChannel: VoiceBasedChannel; audioPlayer?: AudioPlayer }) {
    super();

    this.readyLock = false;
    this.queuer = new Queuer();
    this.processQueuer = new Queuer();

    this.bot = options.bot;
    this.handlers = [];
    this.guild = options.voiceChannel.guild;
    this.manager = options.bot.managers.music;
    this.audioPlayer = options.audioPlayer ?? createAudioPlayer();

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      this.onAudioPlayerStateChange(oldState, newState);
    });

    this.audioPlayer.on('error', error => {
      const resource = error.resource as AudioResource<MusicTrack>;
      resource.metadata.onError(error);
    });

    this.voiceConnection = joinVoiceChannel({
      guildId: options.voiceChannel.guildId,
      channelId: options.voiceChannel.id,
      adapterCreator: options.voiceChannel.guild.voiceAdapterCreator,
    });

    this.voiceConnection.on('stateChange', (oldState, newState) => {
      this.onVoiceConnectionStateChange(oldState, newState);
    });

    this.voiceConnection.subscribe(this.audioPlayer);
  }

  private onAudioPlayerStateChange(oldState: AudioPlayerState, newState: AudioPlayerState) {
    switch (newState.status) {
      case AudioPlayerStatus.Paused: {
        const resouce = newState.resource as AudioResource<MusicTrack>;
        resouce.metadata.onPause();
        break;
      }
      case AudioPlayerStatus.Playing: {
        const resouce = newState.resource as AudioResource<MusicTrack>;
        resouce.metadata.onPlay();
        break;
      }
      default: {
        if (newState.status === AudioPlayerStatus.Idle && oldState.status !== newState.status) {
          const resource = oldState.resource as AudioResource<MusicTrack>;
          resource.metadata.onFinish();
          this.processQueue();
        }
      }
    }
  }

  private async onVoiceConnectionStateChange(
    oldState: VoiceConnectionState,
    newState: VoiceConnectionState,
  ) {
    const isConnecting = newState.status === VoiceConnectionStatus.Connecting;
    const isDestroyed = newState.status === VoiceConnectionStatus.Destroyed;
    const isDisconnected = newState.status === VoiceConnectionStatus.Disconnected;
    const isSignalling = newState.status === VoiceConnectionStatus.Signalling;

    if (isDisconnected) {
      const isWebsocketClosed = newState.reason === VoiceConnectionDisconnectReason.WebSocketClose;

      if (isWebsocketClosed && newState.closeCode === 4014) {
        try {
          await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5000);
        } catch {
          this.voiceConnection.destroy();
        }
      } else if (this.voiceConnection.rejoinAttempts < 5) {
        await Utils.sleep((this.voiceConnection.rejoinAttempts + 1) * 5000);
        this.voiceConnection.rejoin();
      } else {
        this.voiceConnection.destroy();
      }
    } else if (isDestroyed) {
      this.stop({ force: true });
    } else if (!this.readyLock && (isConnecting || isSignalling)) {
      this.readyLock = true;

      try {
        await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20000);
      } catch {
        if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
          this.voiceConnection.destroy();
        }
      }

      this.readyLock = false;
    }
  }

  async checkNextTrack() {
    const logger = this.telemetry.start(this.checkNextTrack, false);

    let track = this.handlers.at(0)?.tracks.at(0);
    if (!track) {
      await this.handlers.at(1)?.loadTracks();
      track = this.handlers.at(1)?.tracks.at(0);
    }

    logger.log(`Handler: ${track?.handler?.type} Track: ${track?.info.toString()}`);

    logger.end();
    return track;
  }

  private async processQueue(highPriority?: boolean) {
    const logger = this.telemetry.start(this.processQueue, false);

    logger.log(`Priority ${highPriority ? 'High' : 'Low'}`);

    const process = async () => {
      const isPlayerNotIdle = this.audioPlayer.state.status !== AudioPlayerStatus.Idle;
      const isHandlerEmpty = this.handlers.length === 0;

      logger.log(`isPlayerNotIdle: ${isPlayerNotIdle} isHandlerEmpty: ${isHandlerEmpty}`);

      if (isPlayerNotIdle || isHandlerEmpty) return;

      // Get current handler
      const handler = this.handlers[0];
      // Load tracks if not laoded
      await handler.loadTracks();
      // Get first track
      const track = handler.tracks.shift();

      if (!track) {
        logger.log('Track Empty - Next Handler');
        // Proceed to next handler
        this.handlers.shift();
        await this.processQueue(true);
        return;
      }

      try {
        const resource = await track.createAudioResource();
        this.audioPlayer.play(resource);
        logger.log('AudioPlayer play resource');
      } catch (error) {
        logger.log('AudioPlayer error - Next Track');
        // Show error and proceed to next track
        track.onError(error);
        await this.processQueue(true);
      }
    };

    if (highPriority) {
      await process();
    } else {
      await this.processQueuer.queue(() => process());
    }

    logger.end();
  }

  get voiceChannel() {
    return this.guild.members.me?.voice.channel;
  }

  async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    // Ignore if guild is not for this subscription
    if (this.guild.id !== newState.guild.id) return;

    // Ignore when not in guild
    const me = newState.guild.members.me;
    if (!me) return;

    // Ignore when not connected
    const botVoiceChannel = newState.guild.members.me?.voice.channel;
    if (!botVoiceChannel) return;

    // Ignore if state change is not a channel change
    if (newState.channelId === oldState.channelId) return;

    if (newState.id === me.id) {
      // State changes of this bot

      // Wait for 5s
      await Utils.sleep(5000);
    } else if (botVoiceChannel.id !== oldState.channelId) {
      // State changes of others

      // Ignore if different channel from the bot
      return;
    }

    // Ignore if members is not empty
    if (botVoiceChannel.members.filter(m => !m.user.bot).size > 0) return;

    await this.terminate();
  }

  async terminate() {
    this.voiceConnection.destroy();
    this.manager.subscriptions.delete(this.guild.id);
    await this.guild.members.me?.voice.disconnect();
  }

  queue(handler: MusicHandler) {
    return this.queuer.queue(async () => {
      this.handlers.push(handler);
      await this.processQueue();
      return this.handlers.length;
    });
  }

  stop(options?: { skipCount?: number; force?: boolean }): number {
    const handler = this.handlers[0];
    if (!handler) return 0;

    let skipped = this.audioPlayer.state.status === AudioPlayerStatus.Idle ? 0 : 1;

    if (options?.skipCount) {
      if (options?.skipCount > 1) {
        skipped += handler.tracks.splice(0, options?.skipCount - 1).length;
      }
    } else {
      this.handlers.forEach(h => {
        skipped += h.tracks.length;
      });
      this.handlers = [];
    }

    this.audioPlayer.stop(options?.force);

    return skipped;
  }
}
