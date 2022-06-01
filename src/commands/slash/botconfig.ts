import { CommandInteraction } from 'discord.js';
import { getBotConfig, setBotConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { BotConfigKeys } from '../../utils/types.js';

export default class BotConfig extends Command {
  constructor() {
    super(
      {
        name: 'botconfig',
        description: 'Gets or sets the bot configuration.',
        type: 'CHAT_INPUT',
        defaultPermission: false,
        options: [
          {
            name: 'get',
            description: 'Gets the value of a bot configuration.',
            type: 'SUB_COMMAND',
            options: [
              {
                name: 'key',
                description: 'The key of the bot configuration.',
                type: 'STRING',
                required: true,
              },
            ],
          },
          {
            name: 'set',
            description: 'Sets the value of a bot configuration.',
            type: 'SUB_COMMAND',
            options: [
              {
                name: 'key',
                description: 'The key of the bot configuration.',
                type: 'STRING',
                required: true,
              },
              {
                name: 'value',
                description: 'The value for this bot configuration key.',
                type: 'STRING',
                required: true,
              },
            ],
          },
        ],
      },
      {
        scope: 'guild',
        guilds: async guild => {
          const guildId = await getBotConfig('ControlServerId');
          if (!guildId || guildId !== guild.id) return false;
          return true;
        },
      },
    );
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const key = interaction.options.getString('key', true) as BotConfigKeys;
    await interaction.deferReply({ ephemeral: true });

    if (interaction.options.getSubcommand() === 'get') {
      const result = await getBotConfig(key);
      await interaction.editReply(`The value of \`${key}\` is \`${result}\`.`);
    } else {
      const value = interaction.options.getString('value', true);
      await setBotConfig(key, value);
      await interaction.editReply(`Bot configuration \`${key}\` is now set to \`${value}\`.`);
    }
  }
}
