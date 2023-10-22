import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  ButtonStyle,
} from 'discord.js';
import type Bot from '../../../modules/bot.js';
import Component from '../component.js';

export default class MusicComponent extends Component {
  constructor(bot: Bot) {
    super(bot, {
      name: 'music',
      data: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              customId: 'pauseplay',
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              emoji: bot.guild?.emojis.cache.find(e => e.name === 'pauseplay')?.toString(),
            },
            {
              customId: 'skip',
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              emoji: bot.guild?.emojis.cache.find(e => e.name === 'skip')?.toString(),
            },
            {
              customId: 'stop',
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              emoji: bot.guild?.emojis.cache.find(e => e.name === 'stop')?.toString(),
            },
            {
              customId: 'list',
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              emoji: bot.guild?.emojis.cache.find(e => e.name === 'queue')?.toString(),
            },
            {
              customId: 'disconnect',
              type: ComponentType.Button,
              style: ButtonStyle.Danger,
              emoji: bot.guild?.emojis.cache.find(e => e.name === 'power')?.toString(),
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: string) {
    const { music } = this.bot.managers;
    const user = interaction.user;

    let result;

    await interaction.deferReply();

    switch (customId) {
      case 'pauseplay': {
        result = music.pauseplay({ user });
        break;
      }
      case 'skip': {
        result = music.skip({ user });
        break;
      }
      case 'stop': {
        result = music.stop({ user });
        break;
      }
      case 'list': {
        result = music.list({ user });
        break;
      }
      case 'disconnect': {
        result = await music.disconnect({ user });
        break;
      }
      default: {
        result = `Unknown component \`${customId}\`.`;
      }
    }

    await interaction.editReply(result);
  }
}
