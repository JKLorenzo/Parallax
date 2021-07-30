import { CommandInteraction } from 'discord.js';
import GlobalCommand from '../structures/command_global.js';

export default class Ping extends GlobalCommand {
  constructor() {
    super({
      name: 'ping',
      description: 'Checks the ping of this bot.',
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
