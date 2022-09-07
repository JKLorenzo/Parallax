import { ApplicationCommandType, CacheType, CommandInteraction } from 'discord.js';
import type Bot from '../../modules/Bot.js';
import Command from '../../structures/Command.js';
import { CommandScope } from '../../utils/Enums.js';

export default class Ping extends Command {
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

  async exec(interaction: CommandInteraction<CacheType>) {
    const ping = Math.round(interaction.client.ws.ping);

    await interaction.reply({
      content: `My current ping to the discord server is ${ping} ms.`,
      ephemeral: true,
    });
  }
}
