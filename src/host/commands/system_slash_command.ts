import {
  ChatInputCommandInteraction,
  type CacheType,
  PermissionFlagsBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../interaction/modules/command.js';
import { CSConstants } from '../../misc/constants.js';
import HostManager from '../host_manager.js';

export default class SystemSlashCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'system',
        description: 'Execute system commands.',
        defaultMemberPermissions: PermissionFlagsBits.Administrator,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'shutdown',
            description: 'Shuts down the system.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'restart',
            description: 'Restarts the system.',

            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'shutdown-vm',
            description: 'Shuts down the virtual machine.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'restart-vm',
            description: 'Restarts the virtual machine.',
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
      {
        scope: CommandScope.Guild,
        guilds: guild => guild.id === CSConstants.GUILD_ID,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const command = interaction.options.getSubcommand();

    await interaction.deferReply({ withResponse: false });

    switch (command) {
      case 'shutdown':
        await HostManager.instance().proxmox.shutdown();
        break;
      case 'restart':
        await HostManager.instance().proxmox.reboot();
        break;
      case 'shutdown-vm':
        await HostManager.instance().proxmox.shutdownVM();
        break;
      case 'restart-vm':
        await HostManager.instance().proxmox.rebootVM();
        break;
    }
  }
}
