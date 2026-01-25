import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  type CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../interaction/modules/command.js';
import HostManager from '../host_manager.js';

export default class SysInfoSlashCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'sysinfo',
        description: 'Shows the system information of the server.',
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
    const { cpu, memory } = await HostManager.instance().proxmox.status();

    const sysEmbed = new EmbedBuilder({
      author: { name: 'Parallax Server System Information' },
      title: 'System',
      fields: [
        {
          name: 'CPU Usage',
          value: cpu,
          inline: true,
        },
        {
          name: 'Memory Usage',
          value: memory,
          inline: true,
        },
      ],
    });

    const battData = HostManager.instance().ups.data;
    const battEmbed = new EmbedBuilder({
      author: { name: 'Parallax Server System Information' },
      title: 'Power Supply',
      fields: [{ name: 'State', value: battData.status.state, inline: false }],
    });

    if (battData.isNormal() || battData.isPowerFail()) {
      battEmbed.addFields([
        { name: 'Load', value: battData.status.powerLoad, inline: true },
        { name: 'Capacity', value: battData.status.capacity, inline: true },
        { name: 'Runtime', value: battData.status.remainingRuntime, inline: true },
        { name: 'Source', value: battData.status.source, inline: false },
        { name: 'Utility', value: battData.status.voltageUtility, inline: true },
        { name: 'Output', value: battData.status.voltageOutput, inline: true },
        { name: 'Line Interaction', value: battData.status.lineInteraction, inline: true },
      ]);
    }

    battEmbed.addFields([{ name: 'Last Event', value: battData.status.lastEvent, inline: true }]);

    await interaction.reply({
      embeds: [sysEmbed, battEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }
}
