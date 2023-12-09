import playdl from 'play-dl';
import PlaylistInfo from '../infos/playlist_info.js';
import TrackInfo from '../infos/track_info.js';
import type { SoundcloudTypes } from '../music_defs.js';
import MusicHandler from '../music_handler.js';
import MusicTrack from '../music_track.js';

export default class SoundcloudHandler extends MusicHandler<SoundcloudTypes> {
  playlist?: playdl.SoundCloudPlaylist;
  track?: playdl.SoundCloudTrack;

  async fetchInfo() {
    const logger = this.telemetry.start(this.fetchInfo, false);

    if (this.infoLoaded) return this.albumInfo ?? this.playlistInfo ?? this.trackInfo;
    this.infoLoaded = true;

    if (this.type === 'so_playlist') {
      this.playlist = (await playdl.soundcloud(this.query)) as playdl.SoundCloudPlaylist;
      this.playlistInfo = new PlaylistInfo({
        info: { name: this.playlist.name, url: this.playlist.url },
        artists: [{ name: this.playlist.user.name, url: this.playlist.user.url }],
      });
      this.totalTracks = this.playlist.tracksCount;
    } else if (this.type === 'so_track') {
      this.track = (await playdl.soundcloud(this.query)) as playdl.SoundCloudTrack;
      this.trackInfo = new TrackInfo({
        info: { name: this.track.name, url: this.track.permalink },
        artists: [{ name: this.track.user.name, url: this.track.user.url }],
      });
      this.totalTracks = 1;
    }

    logger.end();
    return this.playlistInfo ?? this.trackInfo;
  }

  async loadTracks() {
    const logger = this.telemetry.start(this.loadTracks, false);

    if (this.tracksLoaded) return;

    if (this.playlist) {
      const tracks = await this.playlist.all_tracks();
      for (const track of tracks) this.queueTrack(track);
    } else if (this.track) {
      this.queueTrack(this.track);
    }

    this.tracksLoaded = true;
    logger.end();
  }

  private queueTrack(track: playdl.SoundCloudTrack) {
    const thisTrack = new MusicTrack({
      handler: this,
      info: new TrackInfo(
        {
          info: { name: track.name, url: track.url },
          artists: [{ name: track.user.name, url: track.user.url }],
        },
        this.albumInfo ?? this.playlistInfo,
      ),
      imageUrl: track.thumbnail,
      audioUrl: track.url,
    });
    this.tracks.push(thisTrack);
  }
}
