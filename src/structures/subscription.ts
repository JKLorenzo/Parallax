import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { TextChannel } from 'discord.js';
import Track from './track.js';
import { sleep } from '../utils/functions.js';

export default class Subscription {
  readonly voiceConnection: VoiceConnection;
  readonly audioPlayer: AudioPlayer;
  queue: Track[];
  queueLock = false;
  readyLock = false;

  constructor(voiceConnection: VoiceConnection) {
    this.voiceConnection = voiceConnection;
    this.audioPlayer = createAudioPlayer();
    this.queue = [];

    this.voiceConnection.on('stateChange', async (_, newState) => {
      const isDisconnected = newState.status === VoiceConnectionStatus.Disconnected;
      const isDestroyed = newState.status === VoiceConnectionStatus.Destroyed;
      const isConnecting = newState.status === VoiceConnectionStatus.Connecting;
      const isSignalling = newState.status === VoiceConnectionStatus.Signalling;

      if (isDisconnected) {
        const isWebsocketClosed =
          newState.reason === VoiceConnectionDisconnectReason.WebSocketClose;
        if (isWebsocketClosed && newState.closeCode === 4014) {
          try {
            await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000);
          } catch {
            this.voiceConnection.destroy();
          }
        } else if (this.voiceConnection.rejoinAttempts < 5) {
          await sleep((this.voiceConnection.rejoinAttempts + 1) * 5_000);
          this.voiceConnection.rejoin();
        } else {
          this.voiceConnection.destroy();
        }
      } else if (isDestroyed) {
        this.stop({ force: true });
      } else if (!this.readyLock && (isConnecting || isSignalling)) {
        this.readyLock = true;
        try {
          await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20_000);
        } catch {
          if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
            this.voiceConnection.destroy();
          }
        } finally {
          this.readyLock = false;
        }
      }
    });

    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (
        newState.status === AudioPlayerStatus.Idle &&
        oldState.status !== AudioPlayerStatus.Idle
      ) {
        (oldState.resource as AudioResource<Track>).metadata.onFinish();
        this.processQueue();
      } else if (newState.status === AudioPlayerStatus.Playing) {
        (newState.resource as AudioResource<Track>).metadata.onStart();
      }
    });

    this.audioPlayer.on('error', error =>
      (error.resource as AudioResource<Track>).metadata.onError(error),
    );

    voiceConnection.subscribe(this.audioPlayer);
  }

  enqueue(channel: TextChannel, query: string, title?: string, image?: string): Track {
    const track = new Track(channel, query, title, image);
    this.queue.push(track);
    this.processQueue();
    return track;
  }

  stop(options?: { skipCount?: number; force?: boolean }): number {
    let skipped = 0;
    if (options?.force) this.queueLock = true;
    if (options?.skipCount) {
      if (options?.skipCount > 1) {
        skipped = this.queue.splice(0, options?.skipCount - 1).length;
        skipped += this.audioPlayer.state.status === AudioPlayerStatus.Idle ? 0 : 1;
      }
    } else {
      this.queue = [];
    }
    this.audioPlayer.stop(options?.force);
    return skipped;
  }

  private async processQueue(): Promise<void> {
    if (
      this.queueLock ||
      this.audioPlayer.state.status !== AudioPlayerStatus.Idle ||
      this.queue.length === 0
    ) {
      return;
    }

    this.queueLock = true;

    const nextTrack = this.queue.shift()!;
    try {
      const resource = await nextTrack.createAudioResource();

      this.audioPlayer.play(resource);
      this.queueLock = false;
    } catch (error) {
      nextTrack.onError(error as Error);
      this.queueLock = false;
      return this.processQueue();
    }
  }
}
