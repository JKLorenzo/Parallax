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

    const battData = HostManager.instance().ups.getData();
    const battEmbed = new EmbedBuilder({
      author: { name: 'Parallax Server System Information' },
      title: 'Power Supply',
    });

    if (battData.status?.state) {
      battEmbed.addFields([{ name: 'State', value: battData.status?.state, inline: false }]);
    }
    if (battData.status?.powerLoad) {
      battEmbed.addFields([{ name: 'Load', value: battData.status?.powerLoad, inline: true }]);
    }
    if (battData.status?.capacity) {
      battEmbed.addFields([{ name: 'Capacity', value: battData.status?.capacity, inline: true }]);
    }
    if (battData.status?.remainingRuntime) {
      battEmbed.addFields([
        { name: 'Runtime', value: battData.status?.remainingRuntime, inline: true },
      ]);
    }

    if (battData.status?.source) {
      battEmbed.addFields([{ name: 'Source', value: battData.status?.source, inline: false }]);
    }
    if (battData.status?.voltageUtility) {
      battEmbed.addFields([
        { name: 'Utility', value: battData.status?.voltageUtility, inline: true },
      ]);
    }
    if (battData.status?.voltageOutput) {
      battEmbed.addFields([
        { name: 'Output', value: battData.status?.voltageOutput, inline: true },
      ]);
    }
    if (battData.status?.lineInteraction) {
      battEmbed.addFields([
        { name: 'Line Interaction', value: battData.status?.lineInteraction, inline: true },
      ]);
    }

    if (battData.status?.lastEvent) {
      battEmbed.addFields([
        { name: 'Last Event', value: battData.status?.lastEvent, inline: true },
      ]);
    }

    await interaction.reply({
      embeds: [sysEmbed, battEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }
}
