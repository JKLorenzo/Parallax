import { Message, CommandInteraction, type TextBasedChannel, type User } from 'discord.js';
import type AlbumInfo from './infos/album_info.js';
import type PlaylistInfo from './infos/playlist_info.js';
import type TrackInfo from './infos/track_info.js';
import type { MusicHandlerTypes, QueryOptions } from './music_defs.js';
import type MusicInfo from './music_info.js';
import type MusicSubscription from './music_subscription.js';
import type MusicTrack from './music_track.js';
import Telemetry from '../../global/telemetry/telemetry.js';

export default abstract class MusicHandler<T extends MusicHandlerTypes = MusicHandlerTypes> {
  requestId: string;
  subscription: MusicSubscription;
  channel: TextBasedChannel;
  requestedBy: User;
  query: string;
  type: T;
  tracks: MusicTrack[];
  albumInfo: AlbumInfo | undefined;
  playlistInfo: PlaylistInfo | undefined;
  trackInfo: TrackInfo | undefined;

  telemetry: Telemetry;

  infoLoaded: boolean;
  tracksLoaded: boolean;
  totalTracks: number;

  reply?: Message | CommandInteraction;

  constructor(
    subscription: MusicSubscription,
    requestId: string,
    queryOptions: QueryOptions,
    type: T,
  ) {
    this.subscription = subscription;
    this.requestId = requestId;
    this.channel = queryOptions.channel;
    this.requestedBy = queryOptions.requestedBy;
    this.query = queryOptions.query;
    this.type = type;
    this.tracks = [];

    this.infoLoaded = false;
    this.tracksLoaded = false;
    this.totalTracks = 0;

    this.telemetry = new Telemetry(this, { id: requestId, parent: this.subscription.telemetry });
  }

  get loadedInfo(): MusicInfo | undefined {
    return this.albumInfo ?? this.playlistInfo ?? this.trackInfo;
  }

  replyTo(reply: Message | CommandInteraction) {
    this.telemetry.start(this.replyTo, false);
    this.reply = reply;
  }

  skip(count: number) {
    this.telemetry.start(this.skip, false);
    return this.tracks.splice(0, count - 1).length;
  }

  destroy() {
    const telemetry = this.telemetry.start(this.destroy, false);

    try {
      const message = this.reply;
      if (message instanceof Message) {
        message.edit({ components: [] });
      } else if (message instanceof CommandInteraction) {
        message.editReply({ components: [] });
      }
    } catch (e) {
      telemetry.error(e);
    }

    telemetry.end();
  }

  abstract fetchInfo(): Promise<TrackInfo | undefined>;

  abstract loadTracks(): Promise<void> | void;
}
