import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  type CacheType,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../modules/command.js';
import { publicIpv4 } from 'public-ip';

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
    const ipv4 = await publicIpv4();

    await interaction.reply({
      content: [
        `My current ping to the discord server is ${ping} ms.`,
        `My public IP address is \`${ipv4}\`.`,
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
