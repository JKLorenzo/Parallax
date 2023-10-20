import MusicInfo from './music_info.js';

export default class AlbumInfo extends MusicInfo {
  toString() {
    return `${this.info.name} album by ${this.artistToString}`;
  }

  toFormattedString() {
    const info = this.info.url ? `[${this.info.name}](${this.info.url})` : this.info.name;
    return `**${info}** album by **${this.artistToFormattedString}**`;
  }
}
