import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  ButtonStyle,
} from 'discord.js';
import type Bot from '../../../modules/bot.js';
import Utils from '../../../static/utils.js';
import Component from '../component.js';

export default class MusicQueueComponent extends Component {
  constructor(bot: Bot) {
    super(bot, {
      name: 'musicQueue',
      data: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              customId: 'dequeue',
              label: 'Remove this item from the queue',
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              emoji: bot.findEmoji('queue')?.identifier,
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: string) {
    const { music } = this.bot.managers;
    const user = interaction.user;
    const message = interaction.message;

    const footer = message.embeds[0].data.footer?.text;
    if (!footer) return;

    await interaction.deferReply();

    let result;
    const requestId = Utils.parseReqId(footer);

    switch (customId) {
      case 'dequeue': {
        result = music.skipQueue({ user, requestId, textChannel: message.channel });
        break;
      }
      default: {
        result = `Unknown component \`${customId}\`.`;
      }
    }

    await interaction.editReply(result);
  }
}
