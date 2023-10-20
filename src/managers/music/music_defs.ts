import type { BaseMessageOptions, TextBasedChannel, User } from 'discord.js';
import type MusicHandler from './handlers/music_handler.js';
import type MusicSubscription from './music_subscription.js';

export type SpotifyTypes = 'sp_album' | 'sp_playlist' | 'sp_track';
export type YoutubeTypes = 'yt_video' | 'yt_playlist';

export type BasicInfo = {
  name: string;
  url?: string;
};

export type QueryOptions = {
  query: string;
  channel: TextBasedChannel;
  subscription: MusicSubscription;
  requestedBy: User;
};

export type QueryLookupResult = {
  message: BaseMessageOptions;
  handler?: MusicHandler;
};
