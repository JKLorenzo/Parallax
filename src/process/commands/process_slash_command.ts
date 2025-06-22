import {
  ChatInputCommandInteraction,
  type CacheType,
  PermissionFlagsBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  type ApplicationCommandOptionChoiceData,
} from 'discord.js';
import { CommandScope, SlashCommandAutoComplete } from '../../modules/command.js';
import ProcessManager from '../process_manager.js';
import Utils from '../../misc/utils.js';
import { CSConstants } from '../../misc/constants.js';

export default class ProcessSlashCommand extends SlashCommandAutoComplete {
  constructor() {
    super(
      {
        name: 'process',
        description: 'Process Manager',
        defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
        type: ApplicationCommandType.ChatInput,
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
            description: 'Kill the running process.',
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
        scope: CommandScope.Guild,
        guilds: guild => guild.id === CSConstants.GUILD_ID,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    await interaction.deferReply();

    const command = interaction.options.getSubcommand();
    if (command === 'start') {
      const process = interaction.options.getString('process', true);
      const pid = await ProcessManager.instance().start(process);
      if (!pid) return interaction.editReply(`Process failed to start.`);

      await interaction.editReply(`Process started with PID: \`${pid}\``);
    } else if (command === 'kill') {
      const pid = interaction.options.getInteger('pid', true);
      const signal = interaction.options.getInteger('signal', false) ?? undefined;
      const result = ProcessManager.instance().kill(pid, signal);
      await interaction.editReply(result);
    } else if (command === 'update') {
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
