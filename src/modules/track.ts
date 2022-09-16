import { createAudioResource } from '@discordjs/voice';
import { Colors, EmbedBuilder, Message, TextBasedChannel } from 'discord.js';
import playdl from 'play-dl';
import type Subscription from './subscription.js';
import Utils from './utils.js';

const utils = new Utils();

export default class Track {
  private message?: Message;

  channel: TextBasedChannel;
  subscription: Subscription;
  title: string;
  imageUrl?: string;
  audioUrl?: string;

  constructor(
    title: string,
    options: {
      audioUrl?: string;
      imageUrl?: string;
      channel: TextBasedChannel;
      subscription: Subscription;
    },
  ) {
    this.title = title;

    this.audioUrl = options.audioUrl;
    this.imageUrl = options.imageUrl;
    this.channel = options.channel;
    this.subscription = options.subscription;
  }

  async createAudioResource() {
    if (!this.audioUrl) {
      const data = await playdl.search(this.title, { limit: 1, source: { youtube: 'video' } });

      if (data.length > 0) {
        const info = await playdl.video_info(data[0].url);
        const details = info.video_details;
        this.audioUrl = details.url;
      } else {
        throw new Error('No match found for this query.');
      }
    }

    const stream = await playdl.stream(this.audioUrl);
    const resource = createAudioResource(stream.stream, {
      metadata: this,
      inputType: stream.type,
    });

    return resource;
  }

  async onPlay() {
    const voiceChannel = this.subscription.voiceChannel;
    const nextTrack = this.subscription.tracks.at(0);
    const queueLength = this.subscription.tracks.length;
    const bitrate = voiceChannel ? `${voiceChannel.bitrate / 1000}kbps` : 'Unknown';
    const region =
      voiceChannel?.rtcRegion
        ?.split(' ')
        .map(s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`)
        .join(' ') ?? 'Automatic';

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Now Playing' })
      .setTitle(this.title)
      .setDescription(nextTrack ? `Up Next: ${nextTrack.title}` : null)
      .setThumbnail(this.imageUrl ?? null)
      .setFooter({
        text: `Region: ${region}  |  Bitrate: ${bitrate}  |  Queued Songs: ${queueLength}`,
      })
      .setColor(Colors.Green);

    const musicControlsComponent =
      this.subscription.bot.managers.interaction.componentData('music');

    this.message = await (this.message
      ? this.message.edit({
          embeds: [embed],
          components: musicControlsComponent,
        })
      : this.channel.send({ embeds: [embed], components: musicControlsComponent }));
  }

  async onPause() {
    const voiceChannel = this.subscription.voiceChannel;
    const nextTrack = this.subscription.tracks.at(0);
    const queueLength = this.subscription.tracks.length;
    const bitrate = voiceChannel ? `${voiceChannel.bitrate / 1000}kbps` : 'Unknown';
    const region =
      voiceChannel?.rtcRegion
        ?.split(' ')
        .map(s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`)
        .join(' ') ?? 'Automatic';

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Paused' })
      .setTitle(this.title)
      .setDescription(nextTrack ? `Up Next: ${nextTrack.title}` : null)
      .setThumbnail(this.imageUrl ?? null)
      .setFooter({
        text: `Region: ${region}  |  Bitrate: ${bitrate}  |  Queued Songs: ${queueLength}`,
      })
      .setColor(Colors.Yellow);

    const musicControlsComponent =
      this.subscription.bot.managers.interaction.componentData('music');

    this.message = await (this.message
      ? this.message.edit({ embeds: [embed], components: musicControlsComponent })
      : this.channel.send({ embeds: [embed], components: musicControlsComponent }));
  }

  async onFinish() {
    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallax Music Player: Previously Played' })
      .setTitle(this.title)
      .setDescription(`Listen to this song again: [Open](${this.audioUrl}).`)
      .setThumbnail(this.imageUrl ?? null)
      .setFooter(null)
      .setColor(Colors.Blurple);

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

    if (!hasAny(strError, constants.PLAYDL_429_ERROR_PATTERN)) {
      this.message = await (this.message
        ? this.message.edit(`Failed to play ${this.title} due to an error.`)
        : this.channel.send(`Failed to play ${this.title} due to an error.`));
    } else if (!this.subscription.manager.disabled) {
      this.message = await (this.message
        ? this.message.edit(constants.MUSIC_DISABLED)
        : this.channel.send(constants.MUSIC_DISABLED));
    }
  }
}
