import {
  ChatInputCommandInteraction,
  type CacheType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  type ApplicationCommandOptionChoiceData,
  ApplicationIntegrationType,
} from 'discord.js';
import { CommandScope, SlashCommandAutoComplete } from '../../modules/command.js';
import ProcessManager from '../process_manager.js';
import Utils from '../../misc/utils.js';
import DatabaseFacade from '../../database/database_facade.js';

export default class ProcessSlashCommand extends SlashCommandAutoComplete {
  constructor() {
    super(
      {
        name: 'process',
        description: 'Process Manager',
        type: ApplicationCommandType.ChatInput,
        integrationTypes: [
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        ],
        options: [
          {
            name: 'start',
            description: 'Start a process.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'process',
                description: 'Start the selected process.',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true,
              },
            ],
          },
          {
            name: 'kill',
            description: 'Kill a running process.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'pid',
                description: 'The process id to kill.',
                type: ApplicationCommandOptionType.Integer,
                required: true,
                autocomplete: true,
              },
              {
                name: 'signal',
                description:
                  "If no argument is given, the process will be sent the 'SIGTERM' signal.",
                type: ApplicationCommandOptionType.Integer,
                choices: [
                  {
                    name: 'SIGINT - Interrupt the process.',
                    value: 2,
                  },
                  {
                    name: 'SIGTERM - Request termination.',
                    value: 15,
                  },
                  {
                    name: 'SIGKILL - Terminate immediately.',
                    value: 7,
                  },
                ],
              },
            ],
          },
          {
            name: 'update',
            description: 'Update the executables.',
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
      {
        scope: CommandScope.Global,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    await interaction.deferReply();

    const db = DatabaseFacade.instance();
    const botOwnerId = await db.botConfig('BotOwnerId');

    const command = interaction.options.getSubcommand();
    if (command === 'start') {
      const process = interaction.options.getString('process', true);
      const result = await ProcessManager.instance().start(process);
      if (!result) return interaction.editReply(`Process failed to start.`);

      await interaction.editReply(result);
    } else if (command === 'kill') {
      if (interaction.user.id !== botOwnerId) {
        return interaction.editReply(`Permission denied.`);
      }

      const pid = interaction.options.getInteger('pid', true);
      const signal = interaction.options.getInteger('signal', false) ?? undefined;
      const result = ProcessManager.instance().kill(pid, signal);
      await interaction.editReply(result);
    } else if (command === 'update') {
      if (interaction.user.id !== botOwnerId) {
        return interaction.editReply(`Permission denied.`);
      }

      const executables = await ProcessManager.instance().updateExecutables();
      await interaction.editReply(`Loaded ${executables.length} executables.`);
    }
  }

  async autocomplete(interaction: AutocompleteInteraction<CacheType>) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'process') {
      const execNames = ProcessManager.instance().getExecutableNames();
      const choices: ApplicationCommandOptionChoiceData<string>[] = execNames
        .filter(name => Utils.hasAny(name.toLowerCase(), focused.value.toLowerCase()))
        .map(name => ({ name: name, value: name }));

      await interaction.respond(choices);
    } else if (focused.name === 'pid') {
      const opInfo = ProcessManager.instance().getOperatorInfo();
      const choices: ApplicationCommandOptionChoiceData<number>[] = opInfo
        .filter(info => typeof info.pid === 'number')
        .map(info => ({
          name: `${info.pid} - ${info.name}`,
          value: info.pid!,
        }));

      await interaction.respond(choices);
    }
  }
}
