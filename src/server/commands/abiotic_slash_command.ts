import {
  type ChatInputCommandInteraction,
  type CacheType,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../modules/command.js';
import ServerManager from '../server_manager.js';

export default class AbioticCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'abiotic',
        description: 'Abiotic Factor Dedicated Server commands.',
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
            name: 'stop',
            description: 'Force a server shutdown.',
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
        return sm.abiotic.start(interaction);
      case 'update':
        return sm.abiotic.update(interaction);
      case 'stop':
        return sm.abiotic.stop(interaction);
    }
  }
}
