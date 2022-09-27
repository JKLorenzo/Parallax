import { createAudioResource } from '@discordjs/voice';
import { Colors, EmbedBuilder, Message, TextBasedChannel } from 'discord.js';
import playdl from 'play-dl';
import type AlbumInfo from './info_album.js';
import type PlaylistInfo from './info_playlist.js';
import type TrackInfo from './info_track.js';
import type Subscription from './subscription.js';
import Utils from './utils.js';

const utils = new Utils();

export default class Track {
  private message?: Message;

  channel: TextBasedChannel;
  subscription: Subscription;

  info: TrackInfo;
  album?: AlbumInfo;
  playlist?: PlaylistInfo;

  audioUrl?: string;
  imageUrl?: string;

  constructor(options: {
    channel: TextBasedChannel;
    subscription: Subscription;

    info: TrackInfo;
    album?: AlbumInfo;
    playlist?: PlaylistInfo;

    audioUrl?: string;
    imageUrl?: string;
  }) {
    this.channel = options.channel;
    this.subscription = options.subscription;

    this.info = options.info;
    this.album = options.album;
    this.playlist = options.playlist;

    this.audioUrl = options.audioUrl;
    this.imageUrl = options.imageUrl;
  }

  async createAudioResource() {
    if (!this.audioUrl) {
      const data = await playdl.search(this.info.toString(), {
        limit: 1,
        source: { youtube: 'video' },
      });

      if (data.length > 0) {
        const info = await playdl.video_info(data[0].url);
        const details = info.video_details;
        this.audioUrl = details.url;
      }
    }

    if (!this.audioUrl) throw new Error('No match found for this query.');

    const stream = await playdl.stream(this.audioUrl);
    const resource = createAudioResource(stream.stream, {
      metadata: this,
      inputType: stream.type,
    });

    return resource;
  }

  async onPlay() {
    const { track, artists } = this.info;
    const nextTrack = this.subscription.tracks.at(0);

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Now Playing' })
      .setTitle(track.name)
      .setURL(track.url ?? null)
      .setThumbnail(this.imageUrl ?? null)
      .setFields([
        {
          name: 'Artists',
          value: artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', '),
        },
      ])
      .setFooter(nextTrack ? { text: `Up next: ${nextTrack.info.toString()}` } : null)
      .setColor(Colors.Green);

    if (this.playlist) {
      embed.addFields([{ name: 'Playlist', value: this.playlist.toFormattedString() }]);
    }

    if (this.album) {
      embed.addFields([{ name: 'Album', value: this.album.toFormattedString() }]);
    }

    const musicComponent = this.subscription.bot.managers.interaction.componentData('music');

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed], components: musicComponent })
      : this.channel.send({ embeds: [embed], components: musicComponent }));
  }

  async onPause() {
    const { track, artists } = this.info;
    const nextTrack = this.subscription.tracks.at(0);

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Paused' })
      .setTitle(track.name)
      .setURL(track.url ?? null)
      .setThumbnail(this.imageUrl ?? null)
      .setFields([
        {
          name: 'Artists',
          value: artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', '),
        },
      ])
      .setFooter(nextTrack ? { text: `Up next: ${nextTrack.info.toString()}` } : null)
      .setColor(Colors.Yellow);

    if (this.playlist) {
      embed.addFields([{ name: 'Playlist', value: this.playlist.toFormattedString() }]);
    }

    if (this.album) {
      embed.addFields([{ name: 'Album', value: this.album.toFormattedString() }]);
    }

    const musicComponent = this.subscription.bot.managers.interaction.componentData('music');

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed], components: musicComponent })
      : this.channel.send({ embeds: [embed], components: musicComponent }));
  }

  async onFinish() {
    const { track, artists } = this.info;
    const nextTrack = this.subscription.tracks.at(0);

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Previously Played' })
      .setTitle(track.name)
      .setURL(track.url ?? null)
      .setThumbnail(this.imageUrl ?? null)
      .setFields([
        {
          name: 'Artists',
          value: artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', '),
        },
      ])
      .setFooter(nextTrack ? { text: `Up next: ${nextTrack.info.toString()}` } : null)
      .setColor(Colors.Blurple);

    if (this.playlist) {
      embed.addFields([{ name: 'Playlist', value: this.playlist.toFormattedString() }]);
    }

    if (this.album) {
      embed.addFields([{ name: 'Album', value: this.album.toFormattedString() }]);
    }

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed], components: [] })
      : this.channel.send({ embeds: [embed], components: [] }));

    setTimeout(() => {
      if (this.message && this.message.deletable) this.message.delete().catch(() => null);
    }, 15000);
  }

  async onError(error: unknown) {
    const { hasAny, constants } = utils;
    const strError = String(error);
    const embed = new EmbedBuilder({ color: Colors.Fuchsia });

    if (!hasAny(strError, constants.PLAYDL_429_ERROR_PATTERN)) {
      embed.setDescription(`Failed to play ${this.info.toFormattedString()}.`);
    } else if (!this.subscription.manager.disabled) {
      embed.setDescription(constants.MUSIC_DISABLED);
    }

    this.message = await (this.message
      ? this.message.edit(constants.MUSIC_DISABLED)
      : this.channel.send(constants.MUSIC_DISABLED));
  }
}
