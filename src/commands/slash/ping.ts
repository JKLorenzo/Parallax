import { CommandInteraction } from 'discord.js';
import Command from '../../structures/command.js';

export default class Ping extends Command {
  constructor() {
    super('global', {
      name: 'ping',
      description: 'Checks the ping of this bot.',
      type: 'CHAT_INPUT',
      defaultPermission: true,
    });
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const ping = Math.round(interaction.client.ws.ping);

    await interaction.reply({
      content: `My current ping to the discord server is ${ping} ms.`,
      ephemeral: true,
    });
  }
}
