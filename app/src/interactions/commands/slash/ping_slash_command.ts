import { ApplicationCommandType, type CacheType, ChatInputCommandInteraction } from 'discord.js';
import type Bot from '../../../modules/bot.js';
import { CommandScope } from '../../../schemas/enums.js';
import SlashCommand from '../../../structures/command_slash.js';

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
