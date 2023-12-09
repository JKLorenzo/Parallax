import playdl from 'play-dl';
import AlbumInfo from '../infos/album_info.js';
import PlaylistInfo from '../infos/playlist_info.js';
import TrackInfo from '../infos/track_info.js';
import type { DeezerTypes } from '../music_defs.js';
import MusicHandler from '../music_handler.js';
import MusicTrack from '../music_track.js';

export default class DeezerHandler extends MusicHandler<DeezerTypes> {
  album?: playdl.DeezerAlbum;
  playlist?: playdl.DeezerPlaylist;
  track?: playdl.DeezerTrack;

  async fetchInfo() {
    const logger = this.telemetry.start(this.fetchInfo, false);

    if (this.infoLoaded) return this.albumInfo ?? this.playlistInfo ?? this.trackInfo;
    this.infoLoaded = true;

    if (this.type === 'dz_album') {
      this.album = (await playdl.deezer(this.query)) as playdl.DeezerAlbum;
      this.albumInfo = new AlbumInfo({
        info: { name: this.album.title, url: this.album.url },
        artists: [{ name: this.album.artist.name, url: this.album.artist.url }],
      });
      this.totalTracks = this.album.tracksCount;
    } else if (this.type === 'dz_playlist') {
      this.playlist = (await playdl.deezer(this.query)) as playdl.DeezerPlaylist;
      this.playlistInfo = new PlaylistInfo({
        info: { name: this.playlist.title, url: this.playlist.url },
        artists: [{ name: this.playlist.creator.name }],
      });
      this.totalTracks = this.playlist.tracksCount;
    } else if (this.type === 'dz_track') {
      this.track = (await playdl.deezer(this.query)) as playdl.DeezerTrack;
      this.trackInfo = new TrackInfo({
        info: { name: this.track.title, url: this.track.url },
        artists: [{ name: this.track.artist.name, url: this.track.artist.url }],
      });
      this.totalTracks = 1;
    }

    logger.end();
    return this.albumInfo ?? this.playlistInfo ?? this.trackInfo;
  }

  async loadTracks() {
    const logger = this.telemetry.start(this.loadTracks, false);

    if (this.tracksLoaded) return;
    this.tracksLoaded = true;

    const albumOrPlaylist = this.album ?? this.playlist;
    if (albumOrPlaylist) {
      const tracks = await albumOrPlaylist.all_tracks();
      for (const track of tracks) this.queueTrack(track);
    } else if (this.track) {
      this.queueTrack(this.track);
    }

    logger.end();
  }

  private queueTrack(track: playdl.DeezerTrack) {
    const thisTrack = new MusicTrack({
      handler: this,
      info: new TrackInfo(
        {
          info: { name: track.title, url: track.url },
          artists: [{ name: track.artist.name, url: track.artist.url }],
        },
        this.albumInfo ?? this.playlistInfo,
      ),
      imageUrl: track.artist.picture?.small,
    });
    this.tracks.push(thisTrack);
  }
}
