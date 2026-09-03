import {
  type ChatInputCommandInteraction,
  type CacheType,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../interaction/modules/command.js';
import ServerManager from '../server_manager.js';
import type PalworldOperator from '../operators/palworld_operator.js';

export default class PalworldSlashCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'palworld',
        description: 'Palworld Dedicated Server commands.',
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
            name: 'info',
            description: 'Shows the server information and metrics.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'players',
            description: 'Shows the current players.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'announce',
            description: 'Send an announcement to the server.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'message',
                description: 'The message to announce.',
                type: ApplicationCommandOptionType.String,
                required: true,
              },
            ],
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
            name: 'update',
            description: '[Admin] Update the game files of the server.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'stop',
            description: '[Admin] Force a server shutdown (no save).',
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
    const operator = await ServerManager.instance().operator<PalworldOperator>(this.data.name);
    
    const command = interaction.options.getSubcommand();
    switch (command) {
      case 'start':
        return operator?.start(interaction);
      case 'info':
        return operator?.getServerInfo(interaction);
      case 'players':
        return operator?.getPlayers(interaction);
      case 'announce':
        return operator?.announce(interaction);
      case 'save':
        return operator?.save(interaction);
      case 'update':
        if (this.notOwner(interaction)) return;
        return operator?.update(interaction);
      case 'shutdown':
        return operator?.shutdown(interaction, this.notOwner(interaction) ? false : true);
      case 'stop':
        if (this.notOwner(interaction)) return;
        return operator?.stop(interaction);
      case 'kill':
        if (this.notOwner(interaction)) return;

        const signal = interaction.options.getInteger('signal') ?? 15;
        return operator?.kill(interaction, signal);
    }
  }
}
