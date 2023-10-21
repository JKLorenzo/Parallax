import playdl from 'play-dl';
import DeezerHandler from './handlers/deezer_handler.js';
import SearchHandler from './handlers/search_handler.js';
import SoundcloudHandler from './handlers/soundclound_handler.js';
import SpotifyHandler from './handlers/spotify_handler.js';
import YoutubeHandler from './handlers/youtube_handler.js';
import type { QueryOptions } from './music_defs.js';

export default class MusicHandlerFactory {
  static async createHandler(queryOptions: QueryOptions) {
    let handler;

    const queryType = await playdl.validate(queryOptions.query);
    switch (queryType) {
      case 'dz_album':
      case 'dz_playlist':
      case 'dz_track':
        handler = new DeezerHandler(queryOptions, queryType);
        break;
      case 'sp_album':
      case 'sp_playlist':
      case 'sp_track':
        handler = new SpotifyHandler(queryOptions, queryType);
        break;
      case 'so_playlist':
      case 'so_track':
        handler = new SoundcloudHandler(queryOptions, queryType);
        break;
      case 'yt_playlist':
      case 'yt_video':
        handler = new YoutubeHandler(queryOptions, queryType);
        break;
      case 'search':
        handler = new SearchHandler(queryOptions, queryType);
        break;
    }

    return handler;
  }
}
