import playdl from 'play-dl';
import DeezerHandler from './handlers/deezer_handler.js';
import SearchHandler from './handlers/search_handler.js';
import SoundcloudHandler from './handlers/soundclound_handler.js';
import SpotifyHandler from './handlers/spotify_handler.js';
import YoutubeHandler from './handlers/youtube_handler.js';
import type { QueryOptions } from './music_defs.js';
import type MusicSubscription from './music_subscription.js';
import Telemetry from '../../global/telemetry/telemetry.js';

export default class MusicHandlerFactory {
  subscription: MusicSubscription;
  telemetry: Telemetry;

  constructor(subscription: MusicSubscription) {
    this.subscription = subscription;
    this.telemetry = new Telemetry(this, { parent: subscription.telemetry });
  }

  async createHandler(requestId: string, queryOptions: QueryOptions) {
    let handler;
    const queryType = await playdl.validate(queryOptions.query);
    switch (queryType) {
      case 'dz_album':
      case 'dz_playlist':
      case 'dz_track':
        handler = new DeezerHandler(this.subscription, requestId, queryOptions, queryType);
        break;
      case 'sp_album':
      case 'sp_playlist':
      case 'sp_track':
        handler = new SpotifyHandler(this.subscription, requestId, queryOptions, queryType);
        break;
      case 'so_playlist':
      case 'so_track':
        handler = new SoundcloudHandler(this.subscription, requestId, queryOptions, queryType);
        break;
      case 'yt_playlist':
      case 'yt_video':
        handler = new YoutubeHandler(this.subscription, requestId, queryOptions, queryType);
        break;
      case 'search':
        handler = new SearchHandler(this.subscription, requestId, queryOptions, queryType);
        break;
    }

    return handler;
  }
}
