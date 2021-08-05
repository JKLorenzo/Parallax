import { CommandInteraction } from 'discord.js';
import { getGlobalConfig, updateGlobalConfig } from '../modules/database.js';
import GuildCommand from '../structures/command_guild.js';

export default class GlobalConfig extends GuildCommand {
  constructor() {
    super(
      {
        name: 'globalconfig',
        description: 'Gets or sets the global configuration of this bot.',
        defaultPermission: false,
        options: [
          {
            name: 'get',
            description: 'Gets the value of a global configuration.',
            type: 'SUB_COMMAND',
            options: [
              {
                name: 'key',
                description: 'The key of the global configuration.',
                type: 'STRING',
                required: true,
              },
            ],
          },
          {
            name: 'set',
            description: 'Sets the value of a global configuration.',
            type: 'SUB_COMMAND',
            options: [
              {
                name: 'key',
                description: 'The key of the global configuration.',
                type: 'STRING',
                required: true,
              },
              {
                name: 'value',
                description: 'The value for this global configuration key.',
                type: 'STRING',
                required: true,
              },
            ],
          },
        ],
      },
      {
        guilds: async guild => {
          const guildId = (await getGlobalConfig<string>('guildId')) ?? '867716791231971329';
          if (!guildId || guildId !== guild.id) return false;
          return true;
        },
        permissions: { roles: { allow: ['393013053488103435'] } },
      },
    );
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const key = interaction.options.getString('key', true);
    await interaction.defer({ ephemeral: true });

    if (interaction.options.getSubcommand() === 'get') {
      const result = await getGlobalConfig<string>(key);
      await interaction.editReply(`The value of \`${key}\` is \`${result}\`.`);
    } else {
      const value = interaction.options.getString('value', true);
      await updateGlobalConfig(key, value);
      await interaction.editReply(`Global configuration \`${key}\` is now set to \`${value}\`.`);
    }
  }
}
