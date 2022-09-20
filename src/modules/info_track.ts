import type { BasicInfo } from '../schemas/types.js';

export default class TrackInfo {
  track: BasicInfo;
  artists: BasicInfo[];

  constructor(options: { track: BasicInfo; artists: BasicInfo[] }) {
    this.track = options.track;
    this.artists = options.artists;
  }

  toString() {
    return `${this.track.name} by ${this.artists.map(a => a.name).join(', ')}`;
  }

  toFormattedString() {
    const albumName = this.track.url ? `[${this.track.name}](${this.track.url})` : this.track.name;
    const albumArtists = this.artists
      .map(a => (a.url ? `[${a.name}](${a.url})` : a.name))
      .join(', ');

    return `**${albumName}** by **${albumArtists}**`;
  }
}
