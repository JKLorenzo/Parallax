import {
  ChatInputCommandInteraction,
  type CacheType,
  PermissionFlagsBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../interaction/modules/command.js';
import { CSConstants } from '../../misc/constants.js';
import ServerManager from '../server_manager.js';

export default class ServerConfigSlashCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'server_config',
        description: 'Server Configuration.',
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'reload_execs',
            description: 'Reload the executable information.',
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
      {
        scope: CommandScope.Guild,
        guilds: guild => guild.id === CSConstants.GUILD_ID
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const command = interaction.options.getSubcommand();

    if (command === 'reload_execs') {
      await interaction.deferReply();
      const execs = await ServerManager.instance().updateExecutables();
      await interaction.editReply(`${execs.length} executables are loaded.`)
    }
  }
}
