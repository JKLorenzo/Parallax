import { ContextMenuInteraction, Message } from 'discord.js';
import { getGameConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { hasAny, parseMention } from '../../utils/functions.js';

export default class CancelGameInvite extends Command {
  constructor() {
    super(
      {
        name: 'Cancel Game Invite',
        type: 'MESSAGE',
        defaultPermission: true,
      },
      {
        scope: 'guild',
        guilds: async guild => {
          const config = await getGameConfig(guild.id);
          if (config?.enabled) return true;
          return false;
        },
      },
    );
  }

  async exec(interaction: ContextMenuInteraction): Promise<unknown> {
    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getMessage('message', true) as Message;
    const embed = message.embeds[0];
    if (!embed || !embed.author?.name || !hasAny(embed.author.name, ': Game Invites')) {
      return interaction.editReply('Please select the game invite message you want to cancel.');
    }
    if (parseMention(embed.fields[0].value) !== interaction.user.id) {
      return interaction.editReply("You can't cancel other game invites.");
    }

    await message
      .delete()
      .then(() => interaction.editReply(`Your ${embed.title} game invite has been canceled.`))
      .catch(() => interaction.editReply(`Failed to cancel your ${embed.title} game invite.`));
  }
}
