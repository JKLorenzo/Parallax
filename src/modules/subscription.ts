import {
  entersState,
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  VoiceConnection,
  VoiceConnectionState,
  VoiceConnectionStatus,
  VoiceConnectionDisconnectReason,
} from '@discordjs/voice';
import type { Guild, VoiceBasedChannel, VoiceState } from 'discord.js';
import type Bot from './bot.js';
import type Track from './track.js';
import Utils from './utils.js';
import type MusicManager from '../managers/music_manager.js';

export default class Subscription {
  private utils: Utils;
  private queueLock: boolean;
  private readyLock: boolean;

  bot: Bot;
  tracks: Track[];
  readonly guild: Guild;
  readonly manager: MusicManager;
  readonly audioPlayer: AudioPlayer;
  readonly voiceConnection: VoiceConnection;

  constructor(options: { bot: Bot; voiceChannel: VoiceBasedChannel; audioPlayer?: AudioPlayer }) {
    this.utils = new Utils();
    this.queueLock = false;
    this.readyLock = false;

    this.bot = options.bot;
    this.tracks = [];
    this.guild = options.voiceChannel.guild;
    this.manager = options.bot.managers.music;
    this.audioPlayer = options.audioPlayer ?? createAudioPlayer();
    this.voiceConnection = joinVoiceChannel({
      guildId: options.voiceChannel.guildId,
      channelId: options.voiceChannel.id,
      adapterCreator: options.voiceChannel.guild.voiceAdapterCreator,
    });

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      this.onAudioPlayerStateChange(oldState, newState);
    });

    this.audioPlayer.on('error', error => {
      const resource = error.resource as AudioResource<Track>;
      resource.metadata.onError(error);
    });

    this.voiceConnection.on('stateChange', (oldState, newState) => {
      this.onVoiceConnectionStateChange(oldState, newState);
    });

    this.voiceConnection.subscribe(this.audioPlayer);
  }

  private onAudioPlayerStateChange(oldState: AudioPlayerState, newState: AudioPlayerState) {
    switch (newState.status) {
      case AudioPlayerStatus.Paused: {
        const resouce = newState.resource as AudioResource<Track>;
        resouce.metadata.onPause();
        break;
      }
      case AudioPlayerStatus.Playing: {
        const resouce = newState.resource as AudioResource<Track>;
        resouce.metadata.onPlay();
        break;
      }
      default: {
        if (newState.status === AudioPlayerStatus.Idle && oldState.status !== newState.status) {
          const resource = oldState.resource as AudioResource<Track>;
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
        await this.utils.sleep((this.voiceConnection.rejoinAttempts + 1) * 5000);
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

  private async processQueue(ignoreLock?: boolean): Promise<void> {
    const isLocked = !ignoreLock && this.queueLock;
    const isPlayerNotIdle = this.audioPlayer.state.status !== AudioPlayerStatus.Idle;
    const isTrackEmpty = this.tracks.length === 0;

    if (isLocked || isPlayerNotIdle || isTrackEmpty) return;

    this.queueLock = true;

    const track = this.tracks.shift()!;
    try {
      const resource = await track.createAudioResource();
      this.audioPlayer.play(resource);
    } catch (error) {
      track.onError(error);
      this.processQueue(true);
    }

    this.queueLock = false;
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
      await this.bot.utils.sleep(5000);
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

  queue(trackOrTracks: Track | Track[]) {
    if (Array.isArray(trackOrTracks)) {
      this.tracks.push(...trackOrTracks);
    } else {
      this.tracks.push(trackOrTracks);
    }

    this.processQueue();

    return this.tracks.length;
  }

  stop(options?: { skipCount?: number; force?: boolean }): number {
    let skipped = this.audioPlayer.state.status === AudioPlayerStatus.Idle ? 0 : 1;

    if (options?.skipCount) {
      if (options?.skipCount > 1) {
        skipped += this.tracks.splice(0, options?.skipCount - 1).length;
      }
    } else {
      skipped += this.tracks.length;
      this.tracks = [];
    }

    this.audioPlayer.stop(options?.force);

    return skipped;
  }
}
