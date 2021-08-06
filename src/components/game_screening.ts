import { Message, MessageComponentInteraction } from 'discord.js';
import { client } from '../main.js';
import { updateGame } from '../modules/database.js';
import Component from '../structures/component.js';

export default class GameScreening extends Component {
  constructor() {
    super({
      name: 'game_screening',
      options: [
        {
          type: 'ACTION_ROW',
          components: [
            {
              type: 'BUTTON',
              customId: 'approve',
              label: 'Approve',
              emoji: client.emojis.cache.find(e => e.name === 'accept'),
              style: 'SUCCESS',
            },
            {
              type: 'BUTTON',
              customId: 'deny',
              label: 'Deny',
              emoji: client.emojis.cache.find(e => e.name === 'reject'),
              style: 'DANGER',
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: MessageComponentInteraction, customId: string): Promise<void> {
    if (interaction.message instanceof Message && interaction.message.embeds.length) {
      const embed = interaction.message.embeds[0];
      if (embed.fields.length === 0 || !embed.fields[0].value) return;

      await interaction.deferUpdate();
      const game_name = embed.fields[0].value;
      if (customId === 'approve') {
        await updateGame({ name: game_name, status: 'approved' });
      } else {
        await updateGame({ name: game_name, status: 'denied' });
      }
      await interaction.message.delete();
    }
  }
}
