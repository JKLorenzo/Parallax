import { createAudioResource } from '@discordjs/voice';
import { Colors, EmbedBuilder, Message } from 'discord.js';
import playdl from 'play-dl';
import type TrackInfo from './infos/track_info.js';
import type MusicHandler from './music_handler.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import Constants from '../../static/constants.js';
import Utils from '../../static/utils.js';

export default class MusicTrack extends Telemetry {
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
    super({ identifier: options.handler.requestId, broadcast: false });

    this.handler = options.handler;
    this.info = options.info;
    this.audioUrl = options.audioUrl;
    this.imageUrl = options.imageUrl;
  }

  async createAudioResource() {
    const logger = this.telemetry.start(this.createAudioResource);

    if (!this.audioUrl) {
      const trackInfo = this.info;
      const searchQuery = `${trackInfo.info.name} by ${trackInfo.artistToString}`;

      logger.log(`audioUrl is null. Searching ${searchQuery}`);
      const track = await playdl.search(searchQuery, {
        limit: 1,
        source: { youtube: 'video' },
      });

      this.audioUrl = track.at(0)?.url;
    }

    if (!this.audioUrl) {
      logger.log(`audioUrl is still null. Skipping...`);
      throw new Error(`Skipping ${this.info.toFormattedString()}. No match found for this query.`);
    }

    logger.log(`Creating stream for ${this.audioUrl}`);
    const stream = await playdl.stream(this.audioUrl);

    logger.log(`Creating audio resource for steam type ${stream.type}`);
    const resource = createAudioResource(stream.stream, {
      metadata: this,
      inputType: stream.type,
    });

    logger.end();

    return resource;
  }

  async onPlay() {
    const logger = this.telemetry.start(this.onPlay);

    const { info, artists } = this.info;
    logger.log(`Playing ${info.name}`);

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

    logger.end();
  }

  async onPause() {
    const logger = this.telemetry.start(this.onPause);

    const { info, artists } = this.info;
    logger.log(`Paused ${info.name}`);

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

    logger.end();
  }

  async onFinish() {
    const logger = this.telemetry.start(this.onFinish);

    const { info, artists } = this.info;
    logger.log(`Finished ${info.name}`);

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

    logger.end();
  }

  async onError(error: unknown) {
    const logger = this.telemetry.start(this.onError);
    logger.error(error);

    const embed = new EmbedBuilder({ color: Colors.Fuchsia });
    const strError = String(error);

    if (Utils.hasAny(strError, Constants.PLAYDL_429_ERROR_PATTERN)) {
      embed.setDescription(
        `Failed to play ${this.info.toFormattedString()}. PLAYDL_429_ERROR_PATTERN`,
      );
      this.handler.subscription.manager.disabled = true;
    } else if (Utils.hasAny(strError, Constants.TIMEDOUT_ERROR_PATTERN)) {
      embed.setDescription(
        `Failed to play ${this.info.toFormattedString()}. TIMEDOUT_ERROR_PATTERN`,
      );
    } else if (this.handler.subscription.manager.disabled) {
      embed.setDescription(Constants.MUSIC_DISABLED);
    } else if (error instanceof Error) {
      embed.setDescription(error.message);
    } else {
      embed.setDescription(strError);
    }

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed] })
      : this.handler.channel.send({ embeds: [embed] }));

    logger.end();
  }
}
