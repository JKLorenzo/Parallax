import {
  Colors,
  EmbedBuilder,
  type Guild,
  type TextBasedChannel,
  type VoiceBasedChannel,
} from 'discord.js';
import type { Player } from 'lavalink-client';
import { client } from '../../main.js';
import MusicManager from '../music_manager.js';
import Telemetry from '../../telemetry/telemetry.js';
import Utils from '../../misc/utils.js';
import MusicComponent from '../components/music_component.js';
import type { TrackWithMetadata, UnresolvedTrackWithMetadata } from '../music_defs.js';

export default class MusicPlayerOperator {
  private telemetry: Telemetry;

  readonly guild: Guild;
  readonly player: Player;

  constructor(
    manager: MusicManager,
    voiceChannel: VoiceBasedChannel,
    textChannel: TextBasedChannel,
  ) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });

    this.guild = voiceChannel.guild;

    this.player = manager.lavalink.createPlayer({
      guildId: this.guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: textChannel.id,
      selfDeaf: true,
      volume: 100,
    });
  }

  get voiceChannel() {
    return this.guild.members.me?.voice.channel;
  }

  createTrackEmbed(track: TrackWithMetadata, state: 'play' | 'pause' | 'finish' | 'error') {
    const MM = MusicManager.instance();

    const { info, requester, metadata } = track;
    const { title, artworkUrl } = info;
    const trackData = MM.parseTrackData(track);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Parallax Music Player: ${
          state === 'play' ? 'Now Playing' : state === 'pause' ? 'Paused' : 'Previously Played'
        }`,
      })
      .setTitle(metadata.title ?? title)
      .setThumbnail(metadata.artUrl ?? metadata.playlist?.artUrl ?? artworkUrl)
      .setDescription(`[${track.info.title}](${track.info.uri})`)
      .setFields([
        {
          name: 'Artists',
          value: trackData.formatArtist(),
          inline: true,
        },
        { name: 'Requested by', value: requester.toString(), inline: true },
      ])
      .setFooter({ text: Utils.formatReqId(trackData.requestId) })
      .setColor(
        state === 'play' ? Colors.Aqua : state === 'pause' ? Colors.Yellow : Colors.Blurple,
      );

    if (trackData.album) {
      embed.addFields([
        {
          name: 'Album',
          value: `${trackData.formatAlbumName()} by ${trackData.formatAlbumArtist()}`,
          inline: true,
        },
      ]);
    }

    if (trackData.playlist) {
      embed.addFields([
        {
          name: 'Playlist',
          value: `${trackData.formatPlaylistName()} by ${trackData.formatPlaylistArtist()}`,
          inline: true,
        },
      ]);
    }

    switch (state) {
      case 'play':
        embed.setAuthor({ name: 'Parallax Music Player: Now Playing' }).setColor(Colors.Aqua);
        break;
      case 'pause':
        embed.setAuthor({ name: 'Parallax Music Player: Paused' }).setColor(Colors.Yellow);
        break;
      case 'finish':
        embed
          .setAuthor({ name: 'Parallax Music Player: Previously Played' })
          .setColor(Colors.Blurple);
        break;
      case 'error':
      default:
        embed.setAuthor({ name: 'Parallax Music Player: Track Failed' }).setColor(Colors.Fuchsia);
        break;
    }

    const nextTrack = this.player.queue.getTracks(0, 1).at(0) as
      | TrackWithMetadata
      | UnresolvedTrackWithMetadata
      | undefined;

    if (nextTrack) {
      const nextTrackData = MM.parseTrackData(nextTrack);

      embed.addFields([
        {
          name: 'Up next',
          value: `${nextTrackData.formatTitle()} by ${nextTrackData.formatArtist()}`,
        },
      ]);
    }

    return embed;
  }

  async onTrackStart(player: Player, track: TrackWithMetadata) {
    const telemetry = this.telemetry.start('onTrackStart');
    const { guildId, textChannelId } = player;

    telemetry.log({ player, track });

    if (!track) return telemetry.log('track is undefined.').end();

    if (!textChannelId) return telemetry.log('textChannelId is undefined.').end();

    const guild = client.guilds.cache.get(guildId);
    const textChannel = guild?.channels.cache.get(textChannelId);
    if (!textChannel || !textChannel.isSendable())
      return telemetry.log('textChannel is undefined or not sendable.').end();

    track.metadata.message = await textChannel.send({
      embeds: [this.createTrackEmbed(track, 'play')],
      components: MusicComponent.data(),
    });

    telemetry.end();
  }

  async onTrackEnd(player: Player, track: TrackWithMetadata) {
    const telemetry = this.telemetry.start('onTrackEnd');
    const { guildId, textChannelId } = player;

    telemetry.log({ player, track });

    if (!track) return telemetry.log('track is undefined.').end();

    if (!textChannelId) return telemetry.log('textChannelId is undefined.').end();

    const guild = client.guilds.cache.get(guildId);
    const textChannel = guild?.channels.cache.get(textChannelId);
    if (!textChannel || !textChannel.isSendable())
      return telemetry.log('textChannel is undefined or not sendable.').end();

    let message = track.metadata.message;
    const embed = this.createTrackEmbed(track, 'finish');

    if (message) {
      message = await message.edit({ embeds: [embed], components: [] });
    } else {
      message = await textChannel.send({
        embeds: [embed],
        components: [],
      });
    }

    setTimeout(() => {
      if (message && message.deletable) message.delete().catch(() => null);
    }, 15000);

    telemetry.end();
  }

  async onTrackFailed(player: Player, track: TrackWithMetadata) {
    const telemetry = this.telemetry.start('onTrackFailed');
    const { guildId, textChannelId } = player;

    telemetry.log({ player, track });

    if (!track) return telemetry.log('track is undefined.').end();

    if (!textChannelId) return telemetry.log('textChannelId is undefined.').end();

    const guild = client.guilds.cache.get(guildId);
    const textChannel = guild?.channels.cache.get(textChannelId);
    if (!textChannel || !textChannel.isSendable())
      return telemetry.log('textChannel is undefined or not sendable.').end();

    let message = track.metadata.message;
    const embed = this.createTrackEmbed(track, 'error');

    if (message) {
      message = await message.edit({ embeds: [embed], components: [] });
    } else {
      message = await textChannel.send({
        embeds: [embed],
        components: [],
      });
    }

    setTimeout(() => {
      if (message && message.deletable) message.delete().catch(() => null);
    }, 15000);

    telemetry.end();
  }

  async onTrackStuck(player: Player, track: TrackWithMetadata) {
    const telemetry = this.telemetry.start('onTrackStuck');

    await this.onTrackFailed(player, track);

    telemetry.end();
  }

  async onTrackError(player: Player, track: TrackWithMetadata) {
    const telemetry = this.telemetry.start('onTrackError');

    await this.onTrackFailed(player, track);

    telemetry.end();
  }

  async queue(tracks: (TrackWithMetadata | UnresolvedTrackWithMetadata)[]) {
    const telemetry = this.telemetry.start(this.queue);
    const mm = MusicManager.instance();

    if (!mm.lavalink.useable) {
      telemetry.error('No lavalink nodes connected!').end();
      return 0;
    }

    if (!this.voiceChannel) {
      const voiceChannelId = this.player.voiceChannelId;
      if (!voiceChannelId) {
        telemetry.error('No player voice channel.');
        return 0;
      }

      const voiceChannel = this.guild.channels.cache.get(voiceChannelId);
      telemetry.log(`Connecting to ${voiceChannel}.`);

      await this.player.connect();
    }

    telemetry.log(tracks);
    this.player.queue.add(tracks);

    const isNotPlaying = this.player.playing == false;
    const hasCurrentTrack = this.player.queue.current == null;
    const hasQueuedTracks = this.player.queue.tracks.length > 0;

    console.log({ isNotPlaying, hasCurrentTrack, hasQueuedTracks });

    if (isNotPlaying && (hasCurrentTrack || hasQueuedTracks)) {
      this.player.play();
    }

    telemetry.end();

    return tracks.length;
  }

  async resume() {
    const telemetry = this.telemetry.start(this.resume);

    const isNotPlaying = this.player.playing == false;
    const hasCurrentTrack = this.player.queue.current == null;
    const hasQueuedTracks = this.player.queue.tracks.length > 0;

    if (isNotPlaying && (hasCurrentTrack || hasQueuedTracks)) {
      await this.player.resume();
    }

    telemetry.end();

    return this.player.playing;
  }

  async pause() {
    const telemetry = this.telemetry.start(this.pause);

    const isPlaying = this.player.playing == true;
    const hasCurrentTrack = this.player.queue.current == null;
    const hasQueuedTracks = this.player.queue.tracks.length > 0;

    if (isPlaying && (hasCurrentTrack || hasQueuedTracks)) {
      await this.player.pause();
    }

    telemetry.end();

    return this.player.paused;
  }

  async stop() {
    const telemetry = this.telemetry.start(this.stop);

    const tracks = this.player.queue.tracks.length;
    await this.player.stopPlaying();

    telemetry.end();

    return tracks - this.player.queue.tracks.length;
  }

  async skipTracks(count: number | undefined) {
    const telemetry = this.telemetry.start(this.skipTracks);

    const tracks = this.player.queue.tracks.length + (this.player.queue.current ? 1 : 0);
    await this.player.skip(count, false);

    telemetry.end();

    return tracks - this.player.queue.tracks.length;
  }
}
