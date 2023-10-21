import type { BasicInfo } from './music_defs.js';

export default abstract class MusicInfo {
  info: BasicInfo;
  artists: BasicInfo[];

  constructor(options: { info: BasicInfo; artists: BasicInfo[] }) {
    this.info = options.info;
    this.artists = options.artists;
  }

  get artistToString() {
    return this.artists.map(a => a.name).join(', ');
  }

  get artistToFormattedString() {
    return this.artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', ');
  }

  abstract toString(): string;
  abstract toFormattedString(): string;
}
