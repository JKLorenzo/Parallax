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
            name: 'stop',
            description: 'Stop the running process.',
            type: ApplicationCommandOptionType.Subcommand,
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
    } else if (command === 'stop') {
      const stopped = ProcessManager.instance().stop();
      if (!stopped) return interaction.editReply(`Process failed to exit.`);

      await interaction.editReply(`Process exited successfully.`);
    } else if (command === 'update') {
      const executables = await ProcessManager.instance().updateExecutables();
      await interaction.editReply(`Loaded ${executables.length} executables.`);
    }
  }

  async autocomplete(interaction: AutocompleteInteraction<CacheType>) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'process') {
      const executables = ProcessManager.instance().executables;
      const choices: ApplicationCommandOptionChoiceData<string>[] = executables
        .filter(pd => Utils.hasAny(pd.name.toLowerCase(), focused.value.toLowerCase()))
        .map(data => ({
          name: data.name,
          value: data.name,
        }));

      await interaction.respond(choices);
    }
  }
}
