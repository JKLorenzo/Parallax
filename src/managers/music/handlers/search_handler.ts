import playdl from 'play-dl';
import TrackInfo from '../infos/track_info.js';
import type { SearchType } from '../music_defs.js';
import MusicHandler from '../music_handler.js';
import MusicTrack from '../music_track.js';

export default class SearchHandler extends MusicHandler<SearchType> {
  track?: playdl.SoundCloudTrack | playdl.SpotifyTrack | playdl.YouTubeVideo;

  async fetchInfo() {
    const telemetry = this.telemetry.start(this.fetchInfo, false);

    if (this.infoLoaded) return this.trackInfo;
    this.infoLoaded = true;

    try {
      const tracks = await playdl.search(this.query, {
        source: { spotify: 'track' },
        limit: 1,
      });

      this.track = tracks.at(0);
    } catch (_) {
      /* Empty */
    }

    if (!this.track) {
      try {
        const tracks = await playdl.search(this.query, {
          source: { soundcloud: 'tracks' },
          limit: 1,
        });

        this.track = tracks.at(0);
      } catch (_) {
        /* Empty */
      }
    }

    if (!this.track) {
      try {
        const tracks = await playdl.search(this.query, {
          source: { youtube: 'video' },
          limit: 1,
        });

        this.track = tracks.at(0);
      } catch (_) {
        /* Empty */
      }
    }

    if (this.track instanceof playdl.SoundCloudTrack) {
      this.trackInfo = new TrackInfo({
        info: { name: this.track.name, url: this.track.permalink },
        artists: [{ name: this.track.user.name, url: this.track.user.url }],
      });
      this.totalTracks = 1;
    } else if (this.track instanceof playdl.SpotifyTrack) {
      this.trackInfo = new TrackInfo({
        info: { name: this.track.name, url: this.track.url },
        artists: this.track.artists.map(a => ({ name: a.name, url: a.url })),
      });
      this.totalTracks = 1;
    } else if (this.track instanceof playdl.YouTubeVideo) {
      this.trackInfo = new TrackInfo({
        info: { name: this.track.title ?? 'Unknown', url: this.track.url },
        artists: [{ name: this.track.channel?.name ?? 'Unknown', url: this.track.channel?.url }],
      });
      this.totalTracks = 1;
    }

    telemetry.end();
    return this.trackInfo;
  }

  loadTracks() {
    const telemetry = this.telemetry.start(this.loadTracks, false);

    if (this.tracksLoaded || !this.track) return;
    this.tracksLoaded = true;

    let thisTrack: MusicTrack;
    if (this.track instanceof playdl.SoundCloudTrack) {
      thisTrack = new MusicTrack({
        handler: this,
        info: this.trackInfo!,
        imageUrl: this.track.thumbnail,
        audioUrl: this.track.url,
      });
    } else if (this.track instanceof playdl.SpotifyTrack) {
      thisTrack = new MusicTrack({
        handler: this,
        info: this.trackInfo!,
        imageUrl: this.track.thumbnail?.url,
      });
    } else {
      thisTrack = new MusicTrack({
        handler: this,
        info: this.trackInfo!,
        imageUrl: this.track.thumbnails.at(0)?.url,
        audioUrl: this.track.url,
      });
    }

    telemetry.end();
    this.tracks.push(thisTrack);
  }
}
