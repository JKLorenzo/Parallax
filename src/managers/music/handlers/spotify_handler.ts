import playdl from 'play-dl';
import AlbumInfo from '../infos/album_info.js';
import PlaylistInfo from '../infos/playlist_info.js';
import TrackInfo from '../infos/track_info.js';
import type { SpotifyTypes } from '../music_defs.js';
import MusicHandler from '../music_handler.js';
import MusicTrack from '../music_track.js';

export default class SpotifyHandler extends MusicHandler<SpotifyTypes> {
  album?: playdl.SpotifyAlbum;
  playlist?: playdl.SpotifyPlaylist;
  track?: playdl.SpotifyTrack;

  async fetchInfo() {
    const telemetry = this.telemetry.start(this.fetchInfo, false);

    if (this.infoLoaded) return this.albumInfo ?? this.playlistInfo ?? this.trackInfo;
    this.infoLoaded = true;

    if (this.type === 'sp_album') {
      this.album = (await playdl.spotify(this.query)) as playdl.SpotifyAlbum;
      this.albumInfo = new AlbumInfo({
        info: { name: this.album.name, url: this.album.url },
        artists: this.album.artists.map(a => ({ name: a.name, url: a.url })),
      });
      this.totalTracks = this.album.tracksCount;
    } else if (this.type === 'sp_playlist') {
      this.playlist = (await playdl.spotify(this.query)) as playdl.SpotifyPlaylist;
      this.playlistInfo = new PlaylistInfo({
        info: { name: this.playlist.name, url: this.playlist.url },
        artists: [{ name: this.playlist.owner.name, url: this.playlist.owner.url }],
      });
      this.totalTracks = this.playlist.tracksCount;
    } else if (this.type === 'sp_track') {
      this.track = (await playdl.spotify(this.query)) as playdl.SpotifyTrack;
      this.trackInfo = new TrackInfo({
        info: { name: this.track.name, url: this.track.url },
        artists: this.track.artists.map(a => ({ name: a.name, url: a.url })),
      });
      this.totalTracks = 1;
    }

    telemetry.end();
    return this.albumInfo ?? this.playlistInfo ?? this.trackInfo;
  }

  async loadTracks() {
    const telemetry = this.telemetry.start(this.loadTracks, false);

    if (this.tracksLoaded) return;
    this.tracksLoaded = true;

    const albumOrPlaylist = this.album ?? this.playlist;
    if (albumOrPlaylist) {
      const tracks = await albumOrPlaylist.all_tracks();
      for (const track of tracks) this.queueTrack(track);
    } else if (this.track) {
      this.queueTrack(this.track);
    }

    telemetry.end();
  }

  private queueTrack(track: playdl.SpotifyTrack) {
    const thisTrack = new MusicTrack({
      handler: this,
      info: new TrackInfo(
        {
          info: { name: track.name, url: track.url },
          artists: track.artists.map(a => ({ name: a.name, url: a.url })),
        },
        this.albumInfo ?? this.playlistInfo,
      ),
      imageUrl: track.thumbnail?.url,
    });
    this.tracks.push(thisTrack);
  }
}
