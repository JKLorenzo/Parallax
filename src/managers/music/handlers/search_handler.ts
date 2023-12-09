import playdl from 'play-dl';
import TrackInfo from '../infos/track_info.js';
import type { SearchType } from '../music_defs.js';
import MusicHandler from '../music_handler.js';
import MusicTrack from '../music_track.js';

export default class SearchHandler extends MusicHandler<SearchType> {
  track?: playdl.SoundCloudTrack | playdl.SpotifyTrack | playdl.YouTubeVideo;

  async fetchInfo() {
    const logger = this.telemetry.start(this.fetchInfo, false);

    if (this.infoLoaded) return this.trackInfo;
    this.infoLoaded = true;

    // Search using soundcloud
    const soundcloudTrack = playdl.search(this.query, {
      source: { soundcloud: 'tracks' },
      limit: 1,
    });

    // Search using spotify
    const spotifyTrack = playdl.search(this.query, {
      source: { spotify: 'track' },
      limit: 1,
    });

    // Search using youtube
    const youtubeTrack = playdl.search(this.query, {
      source: { youtube: 'video' },
      limit: 1,
    });

    const tracks = await Promise.all([spotifyTrack, soundcloudTrack, youtubeTrack]);
    this.track = tracks.at(0)?.at(0) ?? tracks.at(1)?.at(0) ?? tracks.at(2)?.at(0);

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

    logger.end();
    return this.trackInfo;
  }

  loadTracks() {
    const logger = this.telemetry.start(this.loadTracks, false);

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

    logger.end();
    this.tracks.push(thisTrack);
  }
}
