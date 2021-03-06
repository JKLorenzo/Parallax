import { AudioResource, createAudioResource } from '@discordjs/voice';
import { Message, TextChannel } from 'discord.js';
import playdl from 'play-dl';
import { client } from '../main.js';
import { getComponent } from '../managers/interaction.js';
import { getSubscription, got429, had429 } from '../managers/music.js';
import { hasAny } from '../utils/functions.js';

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

        const queueLength = subscription?.queue.length ?? 'Unknown';
        const bitrate = voice_channel ? `${voice_channel.bitrate / 1000}kbps` : 'Unknown';
        const region =
          voice_channel?.rtcRegion
            ?.split(' ')
            .map(s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`) ?? 'Automatic';

        channel
          .send({
            embeds: [
              {
                author: { name: 'Parallax Music Player: Now Playing' },
                title: this.title,
                description: nextTrack ? `Up Next: ${nextTrack.title}` : '',
                footer: {
                  iconURL: client.emojis.cache.find(e => e.name === 'youtube_music')?.url,
                  text: `YouTube Music  |  Region: ${region}  |  Bitrate: ${bitrate}  |  Queued Songs: ${queueLength}`,
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
        const embed = message.embeds[0]
          .setAuthor({ name: 'Parallax Music Player: Previously Played' })
          .setColor('YELLOW')
          .setFooter(null);

        if (hasAny(this.query, 'youtube')) {
          embed.setDescription(`Listen to this song again on [YouTube](${this.query}).`);
        }

        message.edit({ embeds: [embed], components: [] }).catch(console.warn);
        setTimeout(() => {
          if (message && message.deletable) message.delete().catch(console.warn);
        }, 15000);
      }
    };

    this.onError = error => {
      this.onError = noop;
      console.warn(error);

      const reply = message ? message.edit : channel.send;

      if (hasAny(String(error), 'Got 429 from the request')) {
        if (!had429()) reply(`Music commands are temporarily disabled. Please try again later.`);
        got429();
      } else {
        reply(
          `Failed to play ${this.title ?? this.query} due to an error.\n\`\`\`\n${error}\n\`\`\``,
        );
      }
    };
  }

  async createAudioResource(): Promise<AudioResource<Track>> {
    const type = await playdl.validate(this.query);
    if (type === 'search') {
      const results = await playdl.search(this.query, { limit: 1 });
      if (results.length === 0) throw new Error('No match found for this query.');
      this.query = results[0].url!;
    }

    const stream = await playdl.stream(this.query);
    const resource = createAudioResource(stream.stream, {
      metadata: this,
      inputType: stream.type,
    });
    return resource;
  }
}
