import type { User } from 'discord.js';
import Spotified from 'spotified';
import Telemetry from '../../telemetry/telemetry.js';
import EnvironmentFacade from '../../environment/environment_facade.js';
import MusicManager from '../music_manager.js';
import Utils from '../../misc/utils.js';
import {
  SearchPattern,
  SearchType,
  type Metadata,
  type SearchParams,
  type SearchResult,
  type TrackWithMetadata,
  type UnresolvedTrackWithMetadata,
} from '../music_defs.js';

export default class MusicSearchOperator {
  private telemetry: Telemetry;
  private spotified: Spotified;
  private refreshTime: number;

  constructor(manager: MusicManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });

    this.spotified = new Spotified({
      clientId: EnvironmentFacade.instance().get('spotifyId'),
      clientSecret: EnvironmentFacade.instance().get('spotifySecret'),
    });

    this.refreshTime = Date.now();
  }

  async refreshToken() {
    const telemetry = this.telemetry.start(this.refreshToken);

    try {
      const result = await this.spotified.auth.AuthorizationCode.refreshAccessToken(
        EnvironmentFacade.instance().get('spotifyRefrresh'),
      );

      this.spotified.setBearerToken(result.access_token);
      this.refreshTime = Date.now() + (result.expires_in - 60) * 1000;

      telemetry.log(`Spotify access token refreshed.`);
    } catch (error) {
      telemetry.error(`Failed to refresh Spotify access token: ${error}`);
    }

    telemetry.end();
  }

  getSearchType(query: string): SearchType {
    // Check supported links
    if (SearchPattern.Spotify.test(query)) {
      return SearchType.Spotify;
    }
    if (SearchPattern.YouTube.test(query)) {
      return SearchType.YouTube;
    }

    // Check if it is a link (links except above are unsupported)
    if (SearchPattern.Unsupported.test(query)) {
      return SearchType.Unsupported;
    }

    // Check if it is a valid query
    if (SearchPattern.Query.test(query)) {
      return SearchType.Query;
    }

    return SearchType.Unsupported;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const telemetry = this.telemetry.start(this.search);

    // Check if we need to refresh Spotify token
    if (Date.now() >= this.refreshTime) {
      await this.refreshToken();
    }

    const metadata: Metadata = {
      requestId: Utils.makeId(16),
      totalTracks: 0,
    };

    switch (this.getSearchType(params.query)) {
      case SearchType.Unsupported:
        telemetry.log('Unsupported search type.').end();
        return { metadata, tracks: [] };
      case SearchType.YouTube:
        return this.searchYouTube(metadata, params);
      case SearchType.Spotify:
      default:
        return this.searchSpotify(metadata, params);
    }
  }

  async searchYouTube(_metadata: Metadata, params: SearchParams): Promise<SearchResult> {
    const telemetry = this.telemetry.start(this.searchYouTube);
    const metadata: Metadata = { ..._metadata };
    const tracks: (TrackWithMetadata | UnresolvedTrackWithMetadata)[] = [];

    telemetry.log(params);

    const searchResult = await params.player.search(params.query, params.user);
    if (searchResult.exception) {
      telemetry.error(`Error occured during search: ${searchResult.exception}`).end();
    }

    metadata.totalTracks = tracks.length;
    metadata.artUrl = searchResult.tracks.at(0)?.info.artworkUrl ?? undefined;

    if (searchResult.playlist) {
      metadata.playlist = {
        name: searchResult.playlist.name,
        url: searchResult.playlist.uri,
        artists: searchResult.playlist.author ? [{ name: searchResult.playlist.author }] : [],
        artUrl: searchResult.playlist.thumbnail,
      };
    }

    for (const track of searchResult.tracks) {
      const trackWithMetadata: TrackWithMetadata | UnresolvedTrackWithMetadata = {
        ...track,
        requester: track.requester as User,
        metadata,
      };

      tracks.push(trackWithMetadata);
    }

    telemetry.end();

    return { metadata, tracks };
  }

  async searchSpotify(_metadata: Metadata, params: SearchParams): Promise<SearchResult> {
    const telemetry = this.telemetry.start(this.searchSpotify);
    const metadata: Metadata = { ..._metadata };
    const tracks: (TrackWithMetadata | UnresolvedTrackWithMetadata)[] = [];

    telemetry.log(params);

    if (Utils.hasAny(params.query, 'album/')) {
      /**
       * =========================================
       * Get Album
       * =========================================
       */
      const id = params.query.split('album/')[1].split('&')[0].split('?')[0];
      const album = await this.spotified.album.getAlbum(id);

      metadata.totalTracks = album.tracks.items.length;
      metadata.artUrl = album.images.find(img => img.url)?.url;
      metadata.album = {
        name: album.name,
        url: album.href,
        artists: album.artists
          .filter(a => typeof a.name === 'string')
          .map(artist => ({ name: artist.name!, url: artist.href })),
      };

      for (const track of album.tracks.items) {
        const searchResult = await this.searchYouTube(metadata, {
          ...params,
          query: `${track.name} ${album.artists.map(artist => artist.name).join(', ')}`,
        });

        const streamableTrack = searchResult.tracks.at(0);
        if (streamableTrack) {
          streamableTrack.metadata.title = track.name ?? 'Unknown Track Name';
          streamableTrack.metadata.url = track.href;
          streamableTrack.metadata.artists = track.artists
            ?.filter(a => typeof a.name === 'string')
            .map(artist => ({ name: artist.name!, url: artist.href }));

          tracks.push(streamableTrack);
        }
      }
    } else if (Utils.hasAny(params.query, 'playlist/')) {
      /**
       * =========================================
       * Get Playist
       * =========================================
       */
      const id = params.query.split('playlist/')[1].split('&')[0].split('?')[0];
      const playlist = await this.spotified.playlist.getPlaylist(id);

      metadata.totalTracks = playlist.tracks?.items.length ?? 0;
      metadata.artUrl = playlist.images?.find(img => img.url)?.url;
      metadata.playlist = {
        name: playlist.name ?? 'No info',
        url: playlist.href,
        artists: [{ name: playlist.owner?.display_name ?? 'No info', url: playlist.owner?.href }],
      };

      for (const { track } of playlist.tracks?.items ?? []) {
        if (track?.type !== 'track') continue;

        const searchResult = await this.searchYouTube(metadata, {
          ...params,
          query: `${track?.name} ${track.artists?.map(artist => artist.name).join(', ')}`,
        });

        const streamableTrack = searchResult.tracks.at(0);
        if (streamableTrack) {
          streamableTrack.metadata.title = track.name ?? 'Unknown Track Name';
          streamableTrack.metadata.url = track.href;
          streamableTrack.metadata.artists = track.artists
            ?.filter(a => typeof a.name === 'string')
            .map(artist => ({ name: artist.name!, url: artist.href }));

          tracks.push(streamableTrack);
        }
      }
    } else if (Utils.hasAny(params.query, 'track/')) {
      /**
       * =========================================
       * Get Track
       * =========================================
       */
      const id = params.query.split('track/')[1].split('&')[0].split('?')[0];
      const track = await this.spotified.track.getTrack(id);
      const searchResult = await this.searchYouTube(metadata, {
        ...params,
        query: `${track.name} ${track.artists?.map(artist => artist.name).join(', ')}`,
      });

      const streamableTrack = searchResult.tracks.at(0);
      if (streamableTrack) {
        metadata.totalTracks = streamableTrack.metadata.totalTracks = 1;
        metadata.artUrl = streamableTrack.metadata.artUrl = track.album?.images.find(
          img => img.url,
        )?.url;
        metadata.title = streamableTrack.metadata.title = track.name ?? 'Unknown Track Name';
        metadata.url = streamableTrack.metadata.url = track.href;
        metadata.artists = streamableTrack.metadata.artists = track.artists
          ?.filter(a => typeof a.name === 'string')
          .map(artist => ({ name: artist.name!, url: artist.href }));

        tracks.push(streamableTrack);
      }
    } else {
      /**
       * =========================================
       * Search Query
       * =========================================
       */
      const spotifySearch = await this.spotified.search.searchForItem(
        params.query,
        ['track', 'album'],
        { limit: 1 },
      );

      const track = spotifySearch.tracks?.items.at(0);
      if (track) {
        const searchResult = await this.searchYouTube(metadata, {
          ...params,
          query: `${track.name} ${track.artists?.map(artist => artist.name).join(', ')}`,
        });

        const streamableTrack = searchResult.tracks.at(0);
        if (streamableTrack) {
          metadata.totalTracks = streamableTrack.metadata.totalTracks = 1;
          metadata.artUrl = streamableTrack.metadata.artUrl = track.album?.images.find(
            img => img.url,
          )?.url;
          metadata.title = streamableTrack.metadata.title = track.name ?? 'Unknown Track Name';
          metadata.url = streamableTrack.metadata.url = track.href;
          metadata.artists = streamableTrack.metadata.artists = track.artists
            ?.filter(a => typeof a.name === 'string')
            .map(artist => ({ name: artist.name!, url: artist.href }));

          tracks.push(streamableTrack);
        }
      }
    }

    telemetry.end();

    return { metadata, tracks };
  }
}
