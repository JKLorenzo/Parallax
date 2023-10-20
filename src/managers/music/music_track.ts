import { createAudioResource } from '@discordjs/voice';
import { Colors, EmbedBuilder, Message } from 'discord.js';
import playdl from 'play-dl';
import type MusicHandler from './handlers/music_handler.js';
import type TrackInfo from './infos/track_info.js';
import Utils from '../../modules/utils.js';

const utils = new Utils();

export default class MusicTrack {
  private message?: Message;
  handler: MusicHandler;
  info: TrackInfo;
  audioUrl?: string;
  imageUrl?: string;

  constructor(options: {
    handler: MusicHandler;
    info: TrackInfo;
    audioUrl?: string;
    imageUrl?: string;
  }) {
    this.handler = options.handler;
    this.info = options.info;
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
    const { info, artists } = this.info;
    const nextTrack = await this.handler.subscription.checkNextTrack();

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Now Playing' })
      .setTitle(info.name)
      .setURL(info.url ?? null)
      .setThumbnail(this.imageUrl ?? null)
      .setFields([
        {
          name: 'Artists',
          value: artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', '),
        },
      ])
      .setFooter(nextTrack ? { text: `Up next: ${nextTrack.info.toString()}` } : null)
      .setColor(Colors.Green);

    if (this.handler.playlistInfo) {
      embed.addFields({ name: 'Playlist', value: this.handler.playlistInfo.toFormattedString() });
    }

    if (this.handler.albumInfo) {
      embed.addFields({ name: 'Album', value: this.handler.albumInfo.toFormattedString() });
    }

    embed.addFields({ name: 'Requested by', value: this.handler.requestedBy.toString() });

    const musicComponent =
      this.handler.subscription.bot.managers.interaction.componentData('music');

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed], components: musicComponent })
      : this.handler.channel.send({ embeds: [embed], components: musicComponent }));
  }

  async onPause() {
    const { info, artists } = this.info;
    const nextTrack = await this.handler.subscription.checkNextTrack();

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Paused' })
      .setTitle(info.name)
      .setURL(info.url ?? null)
      .setThumbnail(this.imageUrl ?? null)
      .setFields([
        {
          name: 'Artists',
          value: artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', '),
        },
      ])
      .setFooter(nextTrack ? { text: `Up next: ${nextTrack.info.toString()}` } : null)
      .setColor(Colors.Yellow);

    if (this.handler.playlistInfo) {
      embed.addFields({ name: 'Playlist', value: this.handler.playlistInfo.toFormattedString() });
    }

    if (this.handler.albumInfo) {
      embed.addFields({ name: 'Album', value: this.handler.albumInfo.toFormattedString() });
    }

    embed.addFields({ name: 'Requested by', value: this.handler.requestedBy.toString() });

    const musicComponent =
      this.handler.subscription.bot.managers.interaction.componentData('music');

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed], components: musicComponent })
      : this.handler.channel.send({ embeds: [embed], components: musicComponent }));
  }

  async onFinish() {
    const { info, artists } = this.info;
    const nextTrack = await this.handler.subscription.checkNextTrack();

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Previously Played' })
      .setTitle(info.name)
      .setURL(info.url ?? null)
      .setThumbnail(this.imageUrl ?? null)
      .setFields([
        {
          name: 'Artists',
          value: artists.map(a => (a.url ? `[${a.name}](${a.url})` : a.name)).join(', '),
        },
      ])
      .setFooter(nextTrack ? { text: `Up next: ${nextTrack.info.toString()}` } : null)
      .setColor(Colors.Blurple);

    if (this.handler.playlistInfo) {
      embed.addFields({ name: 'Playlist', value: this.handler.playlistInfo.toFormattedString() });
    }

    if (this.handler.albumInfo) {
      embed.addFields({ name: 'Album', value: this.handler.albumInfo.toFormattedString() });
    }

    embed.addFields({ name: 'Requested by', value: this.handler.requestedBy.toString() });

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed], components: [] })
      : this.handler.channel.send({ embeds: [embed], components: [] }));

    setTimeout(() => {
      if (this.message && this.message.deletable) this.message.delete().catch(() => null);
    }, 15000);
  }

  async onError(error: unknown) {
    const { hasAny, constants } = utils;
    const strError = String(error);
    const embed = new EmbedBuilder({ color: Colors.Fuchsia });

    if (hasAny(strError, constants.PLAYDL_429_ERROR_PATTERN)) {
      embed.setDescription(`Failed to play ${this.info.toFormattedString()}.`);
    } else if (this.handler.subscription.manager.disabled) {
      embed.setDescription(constants.MUSIC_DISABLED);
    }

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed] })
      : this.handler.channel.send({ embeds: [embed] }));
  }
}
