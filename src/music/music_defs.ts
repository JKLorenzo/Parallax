import type { Message, User } from 'discord.js';
import type { Player, Track, UnresolvedTrack } from 'lavalink-client';

export const SearchPattern = {
  Query: /^.{2,}$/,
  Spotify: /^((https:)?\/\/)?open\.spotify\.com\/(?:intl\-.{2}\/)?(track|album|playlist)\//,
  YouTube: /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))/,
  Unsupported:
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi,
};

export enum SearchType {
  Query,
  Spotify,
  YouTube,
  Unsupported,
}

export type SearchParams = {
  query: string;
  user: User;
  player: Player;
};

export type SearchResult = {
  tracks: (TrackWithMetadata | UnresolvedTrackWithMetadata)[];
  metadata: Metadata;
};

export type Metadata = {
  requestId: string;
  totalTracks: number;
  title?: string;
  url?: string;
  artists?: { name: string; url?: string }[];
  artUrl?: string;
  playlist?: {
    name: string;
    url?: string;
    artists: { name: string; url?: string }[];
    artUrl?: string;
  };
  album?: {
    name: string;
    url?: string;
    artists: { name: string; url?: string }[];
  };
  message?: Message;
};

export interface TrackWithMetadata extends Track {
  metadata: Metadata;
  requester: User;
}

export interface UnresolvedTrackWithMetadata extends UnresolvedTrack {
  metadata: Metadata;
  requester: User;
}
