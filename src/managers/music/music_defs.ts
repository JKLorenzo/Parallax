import type { BaseMessageOptions, TextBasedChannel, User } from 'discord.js';
import type MusicHandler from './music_handler.js';

export type BasicInfo = {
  name: string;
  url?: string;
};

export type QueryOptions = {
  query: string;
  channel: TextBasedChannel;
  requestedBy: User;
};

export type QueryLookupResult = {
  message: BaseMessageOptions;
  handler?: MusicHandler;
};

export type SearchType = 'search';
export type SpotifyTypes = 'sp_album' | 'sp_playlist' | 'sp_track';
export type SoundcloudTypes = 'so_playlist' | 'so_track';
export type DeezerTypes = 'dz_track' | 'dz_playlist' | 'dz_album';
export type YoutubeTypes = 'yt_video' | 'yt_playlist';
export type MusicHandlerTypes =
  | SearchType
  | SpotifyTypes
  | SoundcloudTypes
  | DeezerTypes
  | YoutubeTypes;
