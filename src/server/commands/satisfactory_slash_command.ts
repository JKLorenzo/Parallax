import {
  type ChatInputCommandInteraction,
  type CacheType,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../interaction/modules/command.js';
import ServerManager from '../server_manager.js';
import type SatisfactoryOperator from '../operators/satisfactory_operator.js';

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
          {
            name: 'kill',
            description: '[Admin] Kill the process.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'signal',
                description: "The kill signal to send. Default: 'SIGTERM'",
                type: ApplicationCommandOptionType.Integer,
                choices: [
                  {
                    name: 'SIGTERM - terminate whenever',
                    value: 15,
                  },
                  {
                    name: 'SIGKILL - terminate immediately',
                    value: 9,
                  },
                ],
              },
            ],
          },
        ],
      },
      { scope: CommandScope.Global },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const operator = await ServerManager.instance().operator<SatisfactoryOperator>(this.data.name);
    const command = interaction.options.getSubcommand();

    switch (command) {
      case 'start':
        return operator?.start(interaction);
      case 'update':
        return operator?.update(interaction);
      case 'info':
        return operator?.getServerInfo(interaction);
      case 'save':
        return operator?.save(interaction);
      case 'shutdown':
        return operator?.shutdown(interaction);
      case 'kill':
        if (this.notOwner(interaction)) return;

        const signal = interaction.options.getInteger('signal') ?? 15;
        return operator?.kill(interaction, signal);
    }
  }
}
