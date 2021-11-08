import { ContextMenuInteraction, Message } from 'discord.js';
import { musicPlay } from '../../managers/music.js';
import { getMusicConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';

export default class PlayMusic extends Command {
  constructor() {
    super(
      'guild',
      {
        name: 'Play Music',
        type: 'MESSAGE',
        defaultPermission: true,
      },
      {
        guilds: async guild => {
          const config = await getMusicConfig(guild.id);
          if (config?.enabled) return true;
          return false;
        },
      },
    );
  }

  async exec(interaction: ContextMenuInteraction): Promise<void> {
    const message = interaction.options.getMessage('message', true) as Message;

    if (message.author.bot) {
      return interaction.reply({
        content: 'Messages sent by bots are not supported.',
        ephemeral: true,
      });
    }

    await musicPlay(interaction);
  }
}
