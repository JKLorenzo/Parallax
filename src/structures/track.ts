import { AudioResource, createAudioResource } from '@discordjs/voice';
import { Message, TextChannel } from 'discord.js';
import playdl from 'play-dl';
import { getComponent } from '../managers/interaction.js';
import { getSubscription } from '../managers/music.js';

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
      if (message) {
        message.edit(
          `Failed to play ${this.title ?? this.query} due to an error.\n\`\`\`\n${error}\n\`\`\``,
        );
      } else {
        channel.send(
          `Failed to play ${this.title ?? this.query} due to an error.\n\`\`\`\n${error}\n\`\`\``,
        );
      }
    };
  }

  async createAudioResource(): Promise<AudioResource<Track>> {
    const stream = await playdl.stream(this.query);
    const resource = createAudioResource(stream.stream, {
      metadata: this,
      inputType: stream.type,
    });
    return resource;
  }
}
