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
import type { GatewayConfig, MusicConfig } from '../../../../global/database/database_defs.js';
import DatabaseFacade from '../../../../global/database/database_facade.js';
import EnvironmentFacade from '../../../../global/environment/environment_facade.js';
import type Bot from '../../../../modules/bot.js';
import { SlashCommand } from '../../command.js';
import { CommandScope } from '../../interaction_defs.js';

export default class ConfigSlashCommand extends SlashCommand {
  constructor(bot: Bot) {
    super(
      bot,
      {
        name: 'config',
        description: 'Gets or updates the configuration of this server.',
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'music',
            description: 'Gets or updates the music configuration of this server.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'enabled',
                description: 'Enable or disable this config.',
                type: ApplicationCommandOptionType.Boolean,
              },
              {
                name: 'channel',
                description: 'The channel where chats are automatically added to the queue.',
                type: ApplicationCommandOptionType.Channel,
                channelTypes: [ChannelType.GuildText],
              },
              {
                name: 'ignore_prefix',
                description: 'Messages sent in the music channel with this prefix are ignored.',
                type: ApplicationCommandOptionType.String,
                minLength: 1,
              },
            ],
          },
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

    if (command === 'music') {
      const data = {} as MusicConfig;
      const config = (await db.musicConfig(guild.id)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');
      const ignore_prefix = interaction.options.getString('ignore_prefix')?.toLowerCase();

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (channel) config.channel = data.channel = channel.id;
      if (ignore_prefix) {
        let ignored_prefix = config.ignored_prefix ?? [];
        if (ignored_prefix.includes(ignore_prefix)) {
          // Remove prefix
          ignored_prefix = ignored_prefix.filter(prefix => prefix !== ignore_prefix);
        } else {
          // Add prefix
          ignored_prefix.push(ignore_prefix);
        }
        config.ignored_prefix = data.ignored_prefix = ignored_prefix;
      }

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.channel = data.channel = undefined;
          config.ignored_prefix = data.ignored_prefix = [];
        }
      }

      await db.musicConfig(guild.id, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Music Channel**: ${
            config.channel ? (guild.channels.cache.get(config.channel) ?? 'Invalid') : 'Not Set'
          }`,
          `**Ignored Prefix**: ${config.ignored_prefix?.length ? config.ignored_prefix.join(', ') : 'None'}`,
        ].join('\n'),
      );
    } else if (command === 'gateway') {
      const data = {} as GatewayConfig;
      const config = (await db.gatewayConfig(guild.id)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (channel) config.channel = data.channel = channel.id;
      if (role) config.role = data.role = role.id;

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.channel = data.channel = undefined;
          config.role = data.role = undefined;
        }
      }

      await db.gatewayConfig(guild.id, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Channel**: ${
            config.channel ? (guild.channels.cache.get(config.channel) ?? 'Invalid') : 'Not Set'
          }`,
          `**Role**: ${config.role ? (guild.roles.cache.get(config.role) ?? 'Invalid') : 'Not Set'}`,
        ].join('\n'),
      );
    }

    await interaction.editReply({
      embeds: [embed],
      files: [new AttachmentBuilder(env.assetsPath('settings.png'))],
    });
  }
}
