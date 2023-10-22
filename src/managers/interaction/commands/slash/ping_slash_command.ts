import { ApplicationCommandType, type CacheType, ChatInputCommandInteraction } from 'discord.js';
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
      },
      {
        scope: CommandScope.Global,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const ping = Math.round(interaction.client.ws.ping);

    await interaction.reply({
      content: `My current ping to the discord server is ${ping} ms.`,
      ephemeral: true,
    });
  }
}
