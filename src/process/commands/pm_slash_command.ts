import {
  ChatInputCommandInteraction,
  type CacheType,
  PermissionFlagsBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../modules/command.js';
import ProcessManager from '../process_manager.js';
import { Constants } from '../../misc/constants.js';

export default class ProcessManagerSlashCommand extends SlashCommand {
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
                choices: ProcessManager.instance().processDataToChoice(),
              },
            ],
          },
          {
            name: 'stop',
            description: 'Stop the running process.',
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
      {
        scope: CommandScope.Guild,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    await interaction.deferReply();

    const command = interaction.options.getSubcommand();
    if (command === 'start') {
      const process = interaction.options.getString('process', true);
      const pid = ProcessManager.instance().start(process, interaction.channel);
      if (!pid) return interaction.editReply(`Process failed to start.`);

      interaction.editReply(`Process started with PID: \`${pid}\``);
    } else if (command === 'stop') {
      const stopped = ProcessManager.instance().stop();
      if (!stopped) return interaction.editReply(`Process failed to exit.`);

      interaction.editReply(`Process exited successfully.`);
    }
  }
}
