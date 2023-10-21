import MusicInfo from '../music_info.js';

export default class PlaylistInfo extends MusicInfo {
  toString() {
    return `${this.info.name} playlist by ${this.artistToString}`;
  }

  toFormattedString() {
    const info = this.info.url ? `[${this.info.name}](${this.info.url})` : this.info.name;
    return `**${info}** playlist by **${this.artistToFormattedString}**`;
  }
}
