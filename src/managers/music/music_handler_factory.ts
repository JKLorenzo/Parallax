import playdl from 'play-dl';
import SpotifyHandler from './handlers/spotify_handler.js';
import type { QueryOptions } from './music_defs.js';

export default class MusicHandlerFactory {
  static async createHandler(queryOptions: QueryOptions) {
    let handler;

    const queryType = await playdl.validate(queryOptions.query);
    switch (queryType) {
      case 'sp_album':
      case 'sp_playlist':
      case 'sp_track':
        handler = new SpotifyHandler(queryOptions, queryType);
        break;
    }

    return handler;
  }
}
