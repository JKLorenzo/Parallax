import { AudioPlayerStatus } from '@discordjs/voice';
import { ButtonInteraction, Guild } from 'discord.js';
import { client } from '../main.js';
import {
  getSubscription,
  musicPause,
  musicResume,
  musicSkip,
  musicStop,
  musicQueue,
  musicLeave,
} from '../managers/music.js';
import Component from '../structures/component.js';

export default class Music extends Component {
  constructor() {
    super({
      name: 'music',
      options: [
        {
          type: 'ACTION_ROW',
          components: [
            {
              customId: 'pauseplay',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'pauseplay'),
            },
            {
              customId: 'skip',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'skip'),
            },
            {
              customId: 'stop',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'stop'),
            },
            {
              customId: 'queue',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'queue'),
            },
            {
              customId: 'leave',
              type: 'BUTTON',
              label: 'Disconnect',
              style: 'DANGER',
              emoji: client.emojis.cache.find(e => e.name === 'power'),
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: ButtonInteraction, customId: string): Promise<void> {
    switch (customId) {
      case 'pauseplay': {
        const guild = interaction.guild as Guild;
        const subscription = getSubscription(guild.id);

        if (subscription) {
          switch (subscription.audioPlayer.state.status) {
            case AudioPlayerStatus.Paused: {
              await musicResume(interaction);
              break;
            }
            case AudioPlayerStatus.Playing: {
              await musicPause(interaction);
              break;
            }
          }
        }
        break;
      }
      case 'skip': {
        await musicSkip(interaction);
        break;
      }
      case 'stop': {
        await musicStop(interaction);
        break;
      }
      case 'queue': {
        await musicQueue(interaction);
        break;
      }
      case 'leave': {
        await musicLeave(interaction);
        break;
      }
    }
  }
}
