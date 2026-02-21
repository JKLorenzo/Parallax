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
import si from 'systeminformation';
import humanizeDuration from 'humanize-duration';

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
    const toGB = (bytes: number) =>
      `${`${bytes / Math.pow(1000, 3)}`.substring(0, `${bytes / Math.pow(1000, 3)}`.indexOf('.') + 2)} GB`;

    const nodeStatus = await HostManager.instance().proxmox.nodeStatus();
    const currentLoadData = await si.currentLoad();
    const memData = await si.mem();

    const embeds = [
      new EmbedBuilder({
        author: { name: 'System Information' },
        title: 'Host Information',
        fields: [
          {
            name: 'CPU Usage',
            value: `${nodeStatus.cpu.usage.toFixed(2)} % at ${nodeStatus.cpu.freq} MHz`,
            inline: true,
          },
          {
            name: 'CPU Temperature',
            value: `${nodeStatus.cpu.temp} °C`,
            inline: true,
          },
          {
            name: 'Average Load',
            value: nodeStatus.cpu.loadAvg.map(v => `${v} %`).join(' , '),
          },
          {
            name: 'GPU Usage',
            value: `${nodeStatus.gpu.usage} %`,
            inline: true,
          },
          {
            name: 'GPU Temperature',
            value: `${nodeStatus.gpu.temp} °C`,
            inline: true,
          },
          {
            name: 'Memory Usage',
            value: `${Math.round((nodeStatus.memory.used / nodeStatus.memory.total) * 100)} % of ${toGB(nodeStatus.memory.total)}`,
          },
          {
            name: 'Available Memory',
            value: toGB(nodeStatus.memory.available),
            inline: true,
          },
          {
            name: 'Free Memory',
            value: toGB(nodeStatus.memory.free),
            inline: true,
          },
          {
            name: 'SSD Temperature',
            value: `${nodeStatus.ssd.temp.toFixed(2)} °C`,
          },
          {
            name: 'System Uptime',
            value: `${humanizeDuration(nodeStatus.uptime * 1000)}`,
          },
        ],
      }),
      new EmbedBuilder({
        author: { name: 'System Information' },
        title: 'Parallax Information',
        fields: [
          {
            name: 'CPU Usage',
            value: [
              `**Core Average:** ${Math.round(currentLoadData.currentLoad)} %`,
              ...currentLoadData.cpus.map((d, i) => `**Core ${i}:** ${Math.round(d.load)} %`),
            ].join('\n'),
          },
          {
            name: 'Memory Usage',
            value: `${Math.round((memData.used / memData.total) * 100)} % of ${toGB(memData.total)}`,
          },
          {
            name: 'Cached',
            value: toGB(memData.buffcache),
            inline: true,
          },
          {
            name: 'Available',
            value: toGB(memData.available),
            inline: true,
          },
          {
            name: 'Free',
            value: toGB(memData.free),
            inline: true,
          },
        ],
      }),
    ];

    const battData = HostManager.instance().ups.data;
    if (battData) {
      const battEmbed = new EmbedBuilder({
        author: { name: 'System Information' },
        title: 'UPS Information',
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

      embeds.push(battEmbed);
    }

    await interaction.reply({
      embeds: embeds,
      flags: MessageFlags.Ephemeral,
    });
  }
}
