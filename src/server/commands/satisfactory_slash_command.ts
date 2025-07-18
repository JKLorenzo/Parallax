import {
  type ChatInputCommandInteraction,
  type CacheType,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../modules/command.js';
import ServerManager from '../server_manager.js';

export default class SatisfactorySlashCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'satisfactory',
        description: 'Satisfactory Dedicated Server commands.',
        type: ApplicationCommandType.ChatInput,
        integrationTypes: [
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        ],
        options: [
          {
            name: 'start',
            description: 'Start the server if it is not running and get the connection info.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'update',
            description: 'Update the game files of the server.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'info',
            description: 'Shows the server information and metrics.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'save',
            description: 'Initiate a world save.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'shutdown',
            description: 'Initiate a server shutdown.',
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
      { scope: CommandScope.Global },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const sm = ServerManager.instance();
    const command = interaction.options.getSubcommand();

    switch (command) {
      case 'start':
        return sm.satisfactory.start(interaction);
      case 'update':
        return sm.satisfactory.update(interaction);
      case 'info':
        return sm.satisfactory.getServerInfo(interaction);
      case 'save':
        return sm.satisfactory.save(interaction);
      case 'shutdown':
        return sm.satisfactory.shutdown(interaction);
    }
  }
}
