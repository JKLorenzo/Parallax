import playdl from 'play-dl';
import PlaylistInfo from '../infos/playlist_info.js';
import TrackInfo from '../infos/track_info.js';
import type { YoutubeTypes } from '../music_defs.js';
import MusicHandler from '../music_handler.js';
import MusicTrack from '../music_track.js';

export default class YoutubeHandler extends MusicHandler<YoutubeTypes> {
  playlist?: playdl.YouTubePlayList;
  track?: playdl.YouTubeVideo;

  async fetchInfo() {
    if (this.infoLoaded) return this.playlistInfo ?? this.trackInfo;
    this.infoLoaded = true;

    if (this.type === 'yt_playlist') {
      this.playlist = await playdl.playlist_info(this.query);
      this.playlistInfo = new PlaylistInfo({
        info: { name: this.playlist.title ?? 'Unknown Playlist', url: this.playlist.url },
        artists: [
          {
            name: this.playlist.channel?.name ?? 'Unknown Channel',
            url: this.playlist.channel?.url,
          },
        ],
      });
      this.totalTracks = this.playlist.videoCount ?? 1;
    } else if (this.type === 'yt_video') {
      this.track = (await playdl.video_info(this.query)).video_details;
      this.trackInfo = new TrackInfo({
        info: {
          name: this.track.title ?? 'Unknown Title',
          url: this.track.url,
        },
        artists: [
          {
            name: this.track.channel?.name ?? 'Unknown Artist',
            url: this.track.channel?.url,
          },
        ],
      });
      this.totalTracks = 1;
    }

    return this.playlistInfo ?? this.trackInfo;
  }

  async loadTracks() {
    if (this.tracksLoaded) return;
    this.tracksLoaded = true;

    if (this.playlist) {
      const tracks = await this.playlist.all_videos();
      for (const track of tracks) this.queueTrack(track);
    } else if (this.track) {
      this.queueTrack(this.track);
    }
  }

  private queueTrack(track: playdl.YouTubeVideo) {
    const thisTrack = new MusicTrack({
      handler: this,
      info: new TrackInfo(
        {
          info: { name: track.title ?? 'Unknown', url: track.url },
          artists: [{ name: track.channel?.name ?? 'Unknown', url: track.channel?.url }],
        },
        this.albumInfo ?? this.playlistInfo,
      ),
      imageUrl: track.thumbnails.at(0)?.url,
      audioUrl: track.url,
    });
    this.tracks.push(thisTrack);
  }
}
