import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice';
import { Message, TextChannel } from 'discord.js';
import { create } from 'youtube-dl-exec';
import { getComponent } from '../managers/interaction.js';
import { getSubscription } from '../managers/music.js';
import { getSoundCloudTrack } from '../modules/soundcloud.js';
import { getYouTubeInfo, searchYouTube } from '../modules/youtube.js';
import { hasAll, hasAny, parseHTML } from '../utils/functions.js';

const { raw: ytdl } = create();
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

export default class Track {
  query: string;
  title?: string;
  image?: string;
  onStart: () => void;
  onFinish: () => void;
  onError: (error: Error) => void;

  constructor(channel: TextChannel, query: string, title?: string, image?: string) {
    this.query = query;
    this.title = title;
    this.image = image;

    let message: Message | undefined;

    this.onStart = () => {
      this.onStart = noop;
      if (channel && !message) {
        const voice_channel = channel.guild.me?.voice.channel;
        const subscription = getSubscription(channel.guildId);
        const nextTrack = subscription?.queue.at(0);

        channel
          .send({
            embeds: [
              {
                author: { name: 'Parallax Music Player: Now Playing' },
                title: this.title,
                description: nextTrack ? `Up Next: ${nextTrack.title}` : '',
                footer: {
                  text: `Channel: ${voice_channel?.name ?? 'Unknown'}  |  Region: ${
                    voice_channel?.rtcRegion
                      ?.split(' ')
                      .map(s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`) ?? 'Automatic'
                  }  |  Bitrate: ${
                    voice_channel ? `${voice_channel.bitrate / 1000}kbps` : 'Unknown'
                  }`,
                },
                thumbnail: { url: this.image },
                color: 'GREEN',
              },
            ],
            components: getComponent('music'),
          })
          .then(msg => (message = msg))
          .catch(console.warn);
      }
    };

    this.onFinish = () => {
      this.onFinish = noop;
      if (message && message.editable) {
        message
          .edit({
            embeds: [
              message.embeds[0]
                .setAuthor('Parallax Music Player: Previously Played')
                .setColor('YELLOW'),
            ],
            components: [],
          })
          .catch(console.warn);
        setTimeout(() => {
          if (message && message.deletable) message.delete().catch(console.warn);
        }, 10000);
      }
    };

    this.onError = error => {
      this.onError = noop;
      console.warn(error);
      if (message && message.deletable) message.delete().catch(console.warn);
    };
  }

  async createAudioResource(): Promise<AudioResource<Track>> {
    if (!hasAny(this.query, 'http') || hasAny(this.query, 'youtube.com')) {
      let url;
      if (hasAny(this.query, 'http')) {
        url = this.query;
      } else {
        const data = await searchYouTube(this.query);
        if (!data) throw new Error('No track found.');

        const title = parseHTML(data.title).trim();
        const author = parseHTML(data.channelTitle).trim();

        url = data.link;
        if (!this.title) this.title = `${title} by ${author}`;
        if (!this.image) this.image = data.thumbnails.default?.url;
      }

      if (!this.title || !this.image) {
        const info = await getYouTubeInfo(url);
        if (!info) throw new Error('No track info found.');

        const title = parseHTML(info.videoDetails.title).trim();
        const author = parseHTML(info.videoDetails.ownerChannelName).trim();

        if (!this.title) this.title = `${title} by ${author}`;
        if (!this.image) this.image = info.thumbnail_url;
      }

      const process = ytdl(
        url,
        {
          o: '-',
          q: '',
          f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
          r: '100K',
        },
        { stdio: ['ignore', 'pipe', 'ignore'] },
      );

      return new Promise((resolve, reject) => {
        if (!process.stdout) return reject(new Error('No stdout'));

        const stream = process.stdout;
        const onError = (error: Error) => {
          if (!process.killed) process.kill();
          stream.resume();
          reject(error);
        };

        process
          .once('spawn', () => {
            demuxProbe(stream)
              .then(probe =>
                resolve(
                  createAudioResource(probe.stream, { metadata: this, inputType: probe.type }),
                ),
              )
              .catch(onError);
          })
          .catch(onError);
      });
    } else if (hasAll(this.query, ['http', 'soundcloud'])) {
      const song = await getSoundCloudTrack(this.query);
      if (!song) throw new Error('Track not found.');

      const title = parseHTML(song.title).trim();
      const author = parseHTML(song.author.name).trim();

      if (!this.title) this.title = `${title} by ${author}`;
      if (!this.image) this.image = song.thumbnail;

      return new Promise((resolve, reject) => {
        song.downloadProgressive().then(stream => {
          const onError = (error: Error) => {
            if (!stream.destroyed) stream.destroy();
            stream.resume();
            reject(error);
          };

          demuxProbe(stream)
            .then(probe =>
              resolve(createAudioResource(probe.stream, { metadata: this, inputType: probe.type })),
            )
            .catch(onError);
        });
      });
    } else {
      throw new Error('Unsupported Format');
    }
  }
}
