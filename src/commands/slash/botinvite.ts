import { CommandInteraction } from 'discord.js';
import { getBotConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';

export default class BotInvite extends Command {
  constructor() {
    super('global', {
      name: 'botinvite',
      description: 'Invite this bot to your server!',
      type: 'CHAT_INPUT',
      defaultPermission: true,
    });
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const link = await getBotConfig('BotInviteLink');
    if (link) await interaction.editReply(`You can invite this bot through [this link](${link}).`);
  }
}
