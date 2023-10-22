import type { TextBasedChannel, User } from 'discord.js';
import type AlbumInfo from './infos/album_info.js';
import type PlaylistInfo from './infos/playlist_info.js';
import type TrackInfo from './infos/track_info.js';
import type { MusicHandlerTypes, QueryOptions } from './music_defs.js';
import type MusicInfo from './music_info.js';
import type MusicSubscription from './music_subscription.js';
import type MusicTrack from './music_track.js';

export default abstract class MusicHandler<T extends MusicHandlerTypes = MusicHandlerTypes> {
  subscription: MusicSubscription;
  channel: TextBasedChannel;
  requestedBy: User;
  query: string;
  type: T;
  tracks: MusicTrack[];
  albumInfo: AlbumInfo | undefined;
  playlistInfo: PlaylistInfo | undefined;
  trackInfo: TrackInfo | undefined;

  infoLoaded: boolean;
  tracksLoaded: boolean;
  totalTracks: number;

  constructor(queryOptions: QueryOptions, type: T) {
    this.subscription = queryOptions.subscription;
    this.channel = queryOptions.channel;
    this.requestedBy = queryOptions.requestedBy;
    this.query = queryOptions.query;
    this.type = type;
    this.tracks = [];

    this.infoLoaded = false;
    this.tracksLoaded = false;
    this.totalTracks = 0;
  }

  get loadedInfo(): MusicInfo | undefined {
    return this.albumInfo ?? this.playlistInfo ?? this.trackInfo;
  }

  abstract fetchInfo(): Promise<TrackInfo | undefined>;

  abstract loadTracks(): Promise<void> | void;
}
