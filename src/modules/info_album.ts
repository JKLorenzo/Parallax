import TrackInfo from './info_track.js';

export default class AlbumInfo extends TrackInfo {
  toFormattedString() {
    const albumName = this.track.url ? `[${this.track.name}](${this.track.url})` : this.track.name;
    const albumArtists = this.artists
      .map(a => (a.url ? `[${a.name}](${a.url})` : a.name))
      .join(', ');

    return `**${albumName}** album by **${albumArtists}**`;
  }
}
