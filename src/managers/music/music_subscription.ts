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
import { Collection, type Guild, type VoiceBasedChannel, type VoiceState } from 'discord.js';
import type MusicHandler from './music_handler.js';
import MusicHandlerFactory from './music_handler_factory.js';
import type MusicManager from './music_manager.js';
import type MusicTrack from './music_track.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import type Bot from '../../modules/bot.js';
import Queuer from '../../modules/queuer.js';
import Utils from '../../static/utils.js';

export default class MusicSubscription {
  private readyLock: boolean;
  private queuer: Queuer;
  private processQueuer: Queuer;

  readonly bot: Bot;
  readonly guild: Guild;
  readonly manager: MusicManager;
  readonly audioPlayer: AudioPlayer;
  readonly voiceConnection: VoiceConnection;

  handlers: Collection<string, MusicHandler>;
  handlerFactory: MusicHandlerFactory;
  telemetry: Telemetry;

  constructor(options: { bot: Bot; voiceChannel: VoiceBasedChannel; audioPlayer?: AudioPlayer }) {
    this.readyLock = false;
    this.queuer = new Queuer();
    this.processQueuer = new Queuer();

    this.bot = options.bot;
    this.guild = options.voiceChannel.guild;
    this.manager = options.bot.managers.music;
    this.audioPlayer = options.audioPlayer ?? createAudioPlayer();

    this.handlers = new Collection();
    this.handlerFactory = new MusicHandlerFactory(this);
    this.telemetry = new Telemetry(this, { id: this.guild.id, parent: this.manager.telemetry });

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
      this.stop();
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
    const telemetry = this.telemetry.start(this.checkNextTrack, false);

    let track = this.handlers.at(0)?.tracks.at(0);
    if (!track) {
      await this.handlers.at(1)?.loadTracks();
      track = this.handlers.at(1)?.tracks.at(0);
    }

    telemetry.log(`Handler: ${track?.handler?.type} Track: ${track?.info.toString()}`);

    telemetry.end();
    return track;
  }

  private async processQueue(highPriority?: boolean) {
    const telemetry = this.telemetry.start(this.processQueue, false);

    telemetry.log(`Priority ${highPriority ? 'High' : 'Low'}`);

    const process = async () => {
      const isPlayerNotIdle = this.audioPlayer.state.status !== AudioPlayerStatus.Idle;
      const isHandlerEmpty = this.handlers.size === 0;

      telemetry.log(`isPlayerNotIdle: ${isPlayerNotIdle} isHandlerEmpty: ${isHandlerEmpty}`);

      if (isPlayerNotIdle || isHandlerEmpty) return;

      // Get current handler
      const handler = this.handlers.first()!;
      telemetry.log(`Current handler: ${handler.requestId}`);

      // Load tracks if not laoded
      await handler.loadTracks();

      // Get first track
      const track = handler.tracks.shift();
      telemetry.log(`Next track: ${track?.info.toString()}`);

      if (!track) {
        // Proceed to next handler
        handler.destroy();
        this.handlers.delete(handler.requestId);

        await this.processQueue(true);
        return;
      }

      try {
        const resource = await track.createAudioResource();
        this.audioPlayer.play(resource);
        telemetry.log('AudioPlayer play resource');
      } catch (error) {
        telemetry.log('AudioPlayer error - Next Track');
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

    telemetry.end();
  }

  get voiceChannel() {
    return this.guild.members.me?.voice.channel;
  }

  async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const telemetry = this.telemetry.start(this.onVoiceStateUpdate, false);

    // Ignore if guild is not for this subscription
    if (this.guild.id !== newState.guild.id) return;

    // Ignore when not in guild
    const me = newState.guild.members.me ?? oldState.guild.members.me;
    if (!me) return;

    if (this.voiceChannel) {
      if (newState.id === me.id) {
        // State change of bot

        // Ignore if not channel change
        if (oldState.channelId === newState.channelId) return;

        await Utils.sleep(5000);
      } else if (this.voiceChannel.id !== oldState.channelId) {
        // Ignore if user's prev channel is not related to the bot's channel
        return;
      }

      // Ignore if members is not empty
      if (this.voiceChannel.members.filter(m => !m.user.bot).size > 0) return;
    }

    await this.terminate();
    telemetry.end();
  }

  async terminate() {
    const telemetry = this.telemetry.start(this.terminate, false);
    this.voiceConnection.destroy();
    this.manager.subscriptions.delete(this.guild.id);
    await this.guild.members.me?.voice.disconnect();
    telemetry.end();
  }

  queue(handler: MusicHandler) {
    return this.queuer.queue(async () => {
      this.handlers.set(handler.requestId, handler);
      await this.processQueue();
      return this.handlers.size;
    });
  }

  skipQueue(requestId?: string) {
    let isCurrentHandler = false;

    let handler = this.handlers.first();
    if (requestId) handler = this.handlers.get(requestId);

    if (handler) {
      isCurrentHandler = handler.requestId === this.handlers.firstKey();
      handler.destroy();
      this.handlers.delete(handler.requestId);
    }

    // Stops the current track, then proceeds playing the next track if available
    if (isCurrentHandler) this.audioPlayer.stop();

    return handler;
  }

  skipTrack(count = 1) {
    const handler = this.handlers.at(0);
    if (!handler) return 0;

    let skippedTracks = this.audioPlayer.state.status === AudioPlayerStatus.Idle ? 0 : 1;
    if (count > 1) skippedTracks += handler.skip(count);

    // Stops the current track,
    // then proceeds playing the next track if available
    this.audioPlayer.stop();

    return skippedTracks;
  }

  stop(): number {
    let stoppedTracks = this.audioPlayer.state.status === AudioPlayerStatus.Idle ? 0 : 1;

    for (const handler of this.handlers.values()) {
      handler.destroy();
      stoppedTracks += handler.tracks.length;
    }
    this.handlers.clear();

    // Stops the player
    this.audioPlayer.stop(true);

    return stoppedTracks;
  }
}
