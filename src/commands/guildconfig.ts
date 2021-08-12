import {
  CommandInteraction,
  GuildMember,
  MessageAttachment,
  MessageEmbed,
  Permissions,
} from 'discord.js';
import {
  getGameConfig,
  getPlayConfig,
  updateGameConfig,
  updatePlayConfig,
} from '../modules/database.js';
import GlobalCommand from '../structures/globalcommand.js';
import { GameConfig, PlayConfig } from '../utils/types.js';

export default class GuildConfig extends GlobalCommand {
  constructor() {
    super({
      name: 'guildconfig',
      description: 'Gets or updates the configuration of this server.',
      defaultPermission: true,
      options: [
        {
          name: 'game',
          description: 'Gets or updates the game configuration of this server.',
          type: 'SUB_COMMAND',
          options: [
            {
              name: 'enabled',
              description: 'Enable or disable this config.',
              type: 'BOOLEAN',
            },
            {
              name: 'mentionable',
              description: 'Whether the generated game roles are mentionable.',
              type: 'BOOLEAN',
            },
            {
              name: 'color',
              description: 'The role color of generated game roles in hex.',
              type: 'STRING',
            },
            {
              name: 'invite_channel',
              description: 'The channel where game invites will be sent.',
              type: 'CHANNEL',
            },
            {
              name: 'role_reference',
              description: 'The reference role to be used for positioning.',
              type: 'ROLE',
            },
          ],
        },
        {
          name: 'play',
          description: 'Gets or updates the play configuration of this server.',
          type: 'SUB_COMMAND',
          options: [
            {
              name: 'enabled',
              description: 'Enable or disable this config.',
              type: 'BOOLEAN',
            },
            {
              name: 'hoisted',
              description: 'Whether the generated play roles are hoisted.',
              type: 'BOOLEAN',
            },
            {
              name: 'mentionable',
              description: 'Whether the generated play roles are mentionable.',
              type: 'BOOLEAN',
            },
            {
              name: 'color',
              description: 'The role color of generated game roles in hex.',
              type: 'STRING',
            },
            {
              name: 'role_reference',
              description: 'The reference role to be used for positioning.',
              type: 'ROLE',
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const command = interaction.options.getSubcommand();

    // Block dm commands
    if (!interaction.inGuild()) {
      return interaction.reply('This is only available on a guild channel.');
    }
    // Block members without manage server permissions
    if (!member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
      return interaction.reply(
        'You need to have the `Manage Server` permission to use this command.',
      );
    }
    await interaction.deferReply();

    const embed = new MessageEmbed({
      author: {
        name: `${interaction.guild}: Configuration`,
      },
      title: `${command.charAt(0).toUpperCase()}${command.slice(1)} Configuration`,
      footer: {
        text: `Do \`/guildconfig ${command}\` to edit this configuration.`,
      },
      thumbnail: { url: 'attachment://settings.png' },
      color: 'BLURPLE',
    });

    if (command === 'game') {
      const data = {} as GameConfig;
      const config = (await getGameConfig(interaction.guildId)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const mentionable = interaction.options.getBoolean('mentionable');
      const color = interaction.options.getString('color');
      const channel = interaction.options.getChannel('invite_channel');
      const role = interaction.options.getRole('role_reference');

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (typeof mentionable === 'boolean') config.mentionable = data.mentionable = mentionable;
      if (color && /^[0-9A-F]{6}$/i.test(color)) config.color = data.color = `#${color}`;
      if (channel) config.invite_channel = data.invite_channel = channel.id;
      if (role) config.reference_role = data.reference_role = role.id;

      if (data) await updateGameConfig(interaction.guildId, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Mentionable**: ${config.mentionable ? 'True' : 'False'}`,
          `**Color**: ${config.color ?? 'Not Set'}`,
          `**Invite Channel**: ${
            config.invite_channel
              ? interaction.client.guilds.cache
                  .get(interaction.guildId)
                  ?.channels.cache.get(config.invite_channel)
              : 'Not Set' ?? 'Invalid'
          }`,
          `**Role Reference**: ${
            config.reference_role
              ? interaction.client.guilds.cache
                  .get(interaction.guildId)
                  ?.roles.cache.get(config.reference_role)
              : 'Not Set' ?? 'Invalid'
          }`,
        ].join('\n'),
      );
    } else if (command === 'play') {
      const data = {} as PlayConfig;
      const config = (await getPlayConfig(interaction.guildId)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const hoisted = interaction.options.getBoolean('hoisted');
      const mentionable = interaction.options.getBoolean('mentionable');
      const color = interaction.options.getString('color');
      const role = interaction.options.getRole('role_reference');

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (typeof hoisted === 'boolean') config.hoisted = data.hoisted = hoisted;
      if (typeof mentionable === 'boolean') config.mentionable = data.mentionable = mentionable;
      if (color && /^[0-9A-F]{6}$/i.test(color)) config.color = data.color = `#${color}`;
      if (role) config.reference_role = data.reference_role = role.id;

      if (data) await updatePlayConfig(interaction.guildId, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Hoisted**: ${config.hoisted ? 'True' : 'False'}`,
          `**Mentionable**: ${config.mentionable ? 'True' : 'False'}`,
          `**Color**: ${config.color ?? 'Not Set'}`,
          `**Role Reference**: ${
            config.reference_role
              ? interaction.client.guilds.cache
                  .get(interaction.guildId)
                  ?.roles.cache.get(config.reference_role)
              : 'Not Set' ?? 'Invalid'
          }`,
        ].join('\n'),
      );
    }

    await interaction.editReply({
      files: [new MessageAttachment('./src/assets/settings.png')],
      embeds: [embed],
    });
  }
}
