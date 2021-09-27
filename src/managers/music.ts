import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  demuxProbe,
  entersState,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Message, Snowflake, TextChannel } from 'discord.js';
import ytdl from 'ytdl-core';
import { searchYouTube } from '../modules/youtube.js';
import { hasAny, parseHTML, sleep } from '../utils/functions.js';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

const _subscriptions = new Map<Snowflake, MusicSubscription>();

interface TrackData {
  query: string;
  title?: string;
  image?: string;
  onStart: () => void;
  onFinish: () => void;
  onError: (error: Error) => void;
}

export function getSubscription(guild_id: Snowflake): MusicSubscription | undefined {
  return _subscriptions.get(guild_id);
}

export function setSubscription(guild_id: Snowflake, subscription: MusicSubscription): void {
  _subscriptions.set(guild_id, subscription);
}

export function deleteSubscription(guild_id: Snowflake): void {
  _subscriptions.delete(guild_id);
}

export class Track implements TrackData {
  query: string;
  title?: string;
  image?: string;
  onStart: () => void;
  onFinish: () => void;
  onError: (error: Error) => void;

  constructor(channel: TextChannel, query: string, title?: string, image?: string) {
    this.query = query;
    this.title = title;
    this.image = image;

    let message: Message | undefined;

    this.onStart = () => {
      this.onStart = noop;
      if (channel && !message) {
        channel
          .send({
            embeds: [
              {
                author: { name: 'Parallax Music Player' },
                title: 'Now Playing',
                description: `**${this.title}**`,
                thumbnail: { url: this.image },
                color: 'GREEN',
              },
            ],
          })
          .then(msg => (message = msg))
          .catch(console.warn);
      }
    };

    this.onFinish = () => {
      this.onFinish = noop;
      if (message && message.editable) {
        message
          .edit({
            embeds: [
              {
                author: { name: 'Parallax Music Player' },
                title: 'Previously Played',
                description: `**${this.title}**`,
                thumbnail: { url: this.image },
                color: 'YELLOW',
              },
            ],
          })
          .catch(console.warn);
        setTimeout(() => {
          if (message && message.deletable) message.delete().catch(console.warn);
        }, 10000);
      }
    };

    this.onError = error => {
      this.onError = noop;
      console.warn(error);
      if (message && message.deletable) message.delete().catch(console.warn);
    };
  }

  async createAudioResource(): Promise<AudioResource<Track>> {
    let url: string;
    if (hasAny(this.query, 'http')) {
      if (!hasAny(this.query, 'youtube.com')) throw new Error('Unsupported URL.');
      url = this.query;
    } else {
      const data = await searchYouTube(this.query);
      if (!data) throw new Error('No track found.');
      url = data.link;
      if (!this.title) this.title = data.title;
      if (!this.image) this.image = data.thumbnails.default?.url;
    }

    if (!this.title || !this.image) {
      const info = await ytdl.getInfo(url);
      if (!info) throw new Error('No track info found.');
      if (!this.title) this.title = info.videoDetails.title;
      if (!this.image) this.image = info.thumbnail_url;
    }

    this.title = parseHTML(this.title);

    return new Promise((resolve, reject) => {
      const stream = ytdl(url, { filter: 'audioonly' });
      const onError = (error: Error) => {
        stream.resume();
        reject(error);
      };

      demuxProbe(stream)
        .then(probe =>
          resolve(createAudioResource(probe.stream, { metadata: this, inputType: probe.type })),
        )
        .catch(onError);
    });
  }
}

export class MusicSubscription {
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
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        if (
          newState.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
          newState.closeCode === 4014
        ) {
          /*
						If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect,
						but there is a chance the connection will recover itself if the reason of the disconnect was due to
						switching voice channels. This is also the same code for the bot being kicked from the voice channel,
						so we allow 5 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy
						the voice connection.
					*/
          try {
            await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000);
            // Probably moved voice channel
          } catch {
            this.voiceConnection.destroy();
            // Probably removed from voice channel
          }
        } else if (this.voiceConnection.rejoinAttempts < 5) {
          /*
						The disconnect in this case is recoverable, and we also have <5 repeated attempts so we will reconnect.
					*/
          await sleep((this.voiceConnection.rejoinAttempts + 1) * 5_000);
          this.voiceConnection.rejoin();
        } else {
          /*
						The disconnect in this case may be recoverable, but we have no more remaining attempts - destroy.
					*/
          this.voiceConnection.destroy();
        }
      } else if (newState.status === VoiceConnectionStatus.Destroyed) {
        /*
					Once destroyed, stop the subscription
				*/
        this.stop(true);
      } else if (
        !this.readyLock &&
        (newState.status === VoiceConnectionStatus.Connecting ||
          newState.status === VoiceConnectionStatus.Signalling)
      ) {
        /*
					In the Signalling or Connecting states, we set a 20 second time limit for the connection to become ready
					before destroying the voice connection. This stops the voice connection permanently existing in one of these
					states.
				*/
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

    // Configure audio player
    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (
        newState.status === AudioPlayerStatus.Idle &&
        oldState.status !== AudioPlayerStatus.Idle
      ) {
        // If the Idle state is entered from a non-Idle state, it means that an audio resource has finished playing.
        // The queue is then processed to start playing the next track, if one is available.
        (oldState.resource as AudioResource<Track>).metadata.onFinish();
        this.processQueue();
      } else if (newState.status === AudioPlayerStatus.Playing) {
        // If the Playing state has been entered, then a new track has started playback.
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

  stop(force?: boolean): void {
    if (force) this.queueLock = true;
    this.queue = [];
    this.audioPlayer.stop(force);
  }

  private async processQueue(): Promise<void> {
    // If the queue is locked (already being processed), is empty, or the audio player is already playing something, return
    if (
      this.queueLock ||
      this.audioPlayer.state.status !== AudioPlayerStatus.Idle ||
      this.queue.length === 0
    ) {
      return;
    }
    // Lock the queue to guarantee safe access
    this.queueLock = true;

    // Take the first item from the queue. This is guaranteed to exist due to the non-empty check above.
    const nextTrack = this.queue.shift()!;
    try {
      // Attempt to convert the Track into an AudioResource (i.e. start streaming the video)
      const resource = await nextTrack.createAudioResource();
      this.audioPlayer.play(resource);
      this.queueLock = false;
    } catch (error) {
      // If an error occurred, try the next item of the queue instead
      nextTrack.onError(error as Error);
      this.queueLock = false;
      return this.processQueue();
    }
  }
}
