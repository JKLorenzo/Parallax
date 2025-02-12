import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  type CacheType,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import type Bot from '../../../../modules/bot.js';
import { SlashCommand } from '../../command.js';
import { CommandScope } from '../../interaction_defs.js';

export default class PingSlashCommand extends SlashCommand {
  constructor(bot: Bot) {
    super(
      bot,
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
      flags: [MessageFlags.Ephemeral],
    });
  }
}
