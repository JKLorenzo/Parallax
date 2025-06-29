import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  type CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { CommandScope, SlashCommand } from '../../modules/command.js';
import si from 'systeminformation';
import EnvironmentFacade from '../environment_facade.js';

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
    const currentLoadData = await si.currentLoad();
    const cpuSpeedData = await si.cpuCurrentSpeed();
    const cpuEmbed = new EmbedBuilder({
      author: { name: 'Parallax Server System Information' },
      title: 'Processor',
      fields: [
        {
          name: 'Usage',
          value: `${Math.round(currentLoadData.currentLoad)} % at ${cpuSpeedData.avg} GHz`,
        },
        ...currentLoadData.cpus.map((d, i) => ({
          name: `Core ${i}`,
          value: `${Math.round(d.load)} % (${cpuSpeedData.cores[i]} GHz)`,
          inline: true,
        })),
      ],
    });

    const toGB = (bytes: number) =>
      `${`${bytes / Math.pow(1000, 3)}`.substring(0, `${bytes / Math.pow(1000, 3)}`.indexOf('.') + 2)} GB`;

    const memData = await si.mem();
    const memEmbed = new EmbedBuilder({
      author: { name: 'Parallax Server System Information' },
      title: 'Memory',
      fields: [
        {
          name: 'Usage',
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
    });

    const env = EnvironmentFacade.instance();
    const battData = env.battery();
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
      embeds: [cpuEmbed, memEmbed, battEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }
}
