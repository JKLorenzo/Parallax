import AlbumInfo from './album_info.js';
import MusicInfo from './music_info.js';
import PlaylistInfo from './playlist_info.js';
import type { BasicInfo } from '../music_defs.js';

export default class TrackInfo extends MusicInfo {
  albumOrPlaylist?: AlbumInfo | PlaylistInfo;

  constructor(
    options: { info: BasicInfo; artists: BasicInfo[] },
    albumOrPlaylist?: AlbumInfo | PlaylistInfo,
  ) {
    super(options);
    this.albumOrPlaylist = albumOrPlaylist;
  }

  toString() {
    if (this.albumOrPlaylist instanceof AlbumInfo) {
      return `${this.info.name} by ${this.artistToString} on ${this.albumOrPlaylist.info.name} playlist`;
    } else if (this.albumOrPlaylist instanceof PlaylistInfo) {
      return `${this.info.name} by ${this.artistToString} on ${this.albumOrPlaylist.info.name} album`;
    } else {
      return `${this.info.name} by ${this.artistToString}`;
    }
  }

  toFormattedString() {
    const info = this.info.url ? `[${this.info.name}](${this.info.url})` : this.info.name;
    const albumOrPlaylist = this.albumOrPlaylist?.info.url
      ? `[${this.albumOrPlaylist.info.name}](${this.albumOrPlaylist.info.url})`
      : this.albumOrPlaylist?.info.name;

    if (this.albumOrPlaylist instanceof AlbumInfo) {
      return `**${info}** by **${this.artistToFormattedString}** on **${albumOrPlaylist}** playlist`;
    } else if (this.albumOrPlaylist instanceof PlaylistInfo) {
      return `**${info}** by **${this.artistToFormattedString}** on **${albumOrPlaylist}** album`;
    } else {
      return `**${info}** by **${this.artistToFormattedString}**`;
    }
  }
}
