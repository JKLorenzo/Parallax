import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  type CacheType,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../modules/command.js';

export default class PingSlashCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'ping',
        description: 'Checks the ping of this bot.',
        type: ApplicationCommandType.ChatInput,
        integrationTypes: [
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        ],
      },
      {
        scope: CommandScope.Global,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const ping = Math.round(interaction.client.ws.ping ?? 999);

    await interaction.reply({
      content: `My current ping to the discord server is ${ping} ms.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
