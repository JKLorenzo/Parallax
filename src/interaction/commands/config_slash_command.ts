import {
  ChatInputCommandInteraction,
  type CacheType,
  PermissionFlagsBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ChannelType,
  EmbedBuilder,
  Colors,
  AttachmentBuilder,
} from 'discord.js';
import DatabaseFacade from '../../database/database_facade.js';
import EnvironmentFacade from '../../environment/environment_facade.js';
import type { GameConfig, GatewayConfig } from '../../database/database_defs.js';
import { CommandScope, SlashCommand } from '../../modules/command.js';

export default class ConfigSlashCommand extends SlashCommand {
  constructor() {
    super(
      {
        name: 'config',
        description: 'Gets or updates the configuration of this server.',
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'gateway',
            description: 'Gets or updates the gateway configuration of this server.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'enabled',
                description: 'Enable or disable this config.',
                type: ApplicationCommandOptionType.Boolean,
              },
              {
                name: 'channel',
                description: 'The channel where gateway notifications will be be sent.',
                type: ApplicationCommandOptionType.Channel,
                channelTypes: [ChannelType.GuildText],
              },
              {
                name: 'role',
                description: 'The role that will be given to approved users.',
                type: ApplicationCommandOptionType.Role,
              },
            ],
          },
          {
            name: 'game',
            description: 'Gets or updates the game configuration of this server.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'enabled',
                description: 'Enable or disable this config.',
                type: ApplicationCommandOptionType.Boolean,
              },
              {
                name: 'channel',
                description: 'The channel where game screening will be be moderated.',
                type: ApplicationCommandOptionType.Channel,
                channelTypes: [ChannelType.GuildText],
              },
              {
                name: 'role',
                description: 'The role to be used as reference for the created game roles.',
                type: ApplicationCommandOptionType.Role,
              },
            ],
          },
        ],
      },
      {
        scope: CommandScope.Guild,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const db = DatabaseFacade.instance();
    const env = EnvironmentFacade.instance();
    const command = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    await interaction.deferReply();

    const embed = new EmbedBuilder({
      author: {
        name: `${interaction.guild}: Configuration`,
      },
      title: `${command
        .split('_')
        .map(c => `${c.charAt(0).toUpperCase()}${c.slice(1)}`)
        .join(' ')} Configuration`,
      footer: {
        text: `Do \`/config ${command}\` to edit this configuration.`,
      },
      thumbnail: { url: 'attachment://settings.png' },
      color: Colors.Blurple,
    });

    if (command === 'gateway') {
      const data = {} as GatewayConfig;
      const config = (await db.gameConfig(guild.id)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const role = interaction.options.getRole('role');

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (role) config.role = data.role = role.id;

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.role = data.role = undefined;
        }
      }

      await db.gameConfig(guild.id, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Role**: ${config.role ? (guild.roles.cache.get(config.role) ?? 'Invalid') : 'Not Set'}`,
        ].join('\n'),
      );
    } else if (command === 'game') {
      const data = {} as GameConfig;
      const config = (await db.gameConfig(guild.id)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (role) config.role = data.role = role.id;
      if (channel) config.channel = data.channel = channel.id;

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.role = data.role = undefined;
          config.channel = data.channel = undefined;
        }
      }

      await db.gameConfig(guild.id, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Role**: ${config.role ? (guild.roles.cache.get(config.role) ?? 'Invalid') : 'Not Set'}`,
          `**Channel**: ${config.channel ? (guild.channels.cache.get(config.channel) ?? 'Invalid') : 'Not Set'}`,
        ].join('\n'),
      );
    }

    await interaction.editReply({
      embeds: [embed],
      files: [new AttachmentBuilder(env.assetsPath('settings.png'))],
    });
  }
}
