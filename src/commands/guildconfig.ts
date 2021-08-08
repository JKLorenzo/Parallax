import {
  CommandInteraction,
  GuildMember,
  MessageAttachment,
  MessageEmbed,
  Permissions,
} from 'discord.js';
import { getGameConfig, updateGameConfig } from '../modules/database.js';
import GlobalCommand from '../structures/globalcommand.js';
import { GameConfig } from '../utils/types.js';

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
          type: 'SUB_COMMAND_GROUP',
          options: [
            {
              name: 'get',
              description: 'Gets the current game configuration of this server.',
              type: 'SUB_COMMAND',
            },
            {
              name: 'update',
              description: 'Updates the game configuration of this server.',
              type: 'SUB_COMMAND',
              options: [
                {
                  name: 'enabled',
                  description: 'Enable or disable this config.',
                  type: 'BOOLEAN',
                },
                {
                  name: 'channel',
                  description: 'The channel where game invites will be sent.',
                  type: 'CHANNEL',
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
              ],
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const command = interaction.options.getSubcommand();
    const commandGroup = interaction.options.getSubcommandGroup();

    // Block dm commands
    if (!interaction.inGuild()) {
      await interaction.reply('This is only available on a guild channel.');
      return;
    }
    // Block members without manage server permissions
    if (command !== 'get' && !member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
      await interaction.reply(
        'You need to have the `Manage Server` permission to use this command.',
      );
      return;
    }
    await interaction.deferReply();

    if (commandGroup === 'game') {
      const config = (await getGameConfig(interaction.guildId)) ?? {};
      if (interaction.options.getSubcommand() === 'update') {
        const data = {} as GameConfig;
        const enabled = interaction.options.getBoolean('enabled');
        const channel = interaction.options.getChannel('channel');
        const mentionable = interaction.options.getBoolean('mentionable');
        const color = interaction.options.getString('color');

        if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
        if (typeof mentionable === 'boolean') config.mentionable = data.mentionable = mentionable;
        if (channel) config.invite_channel = data.invite_channel = channel.id;
        if (color && /^[0-9A-F]{6}$/i.test(color)) config.color = data.color = `#${color}`;

        if (data) await updateGameConfig(interaction.guildId, data);
      }

      await interaction.editReply({
        files: [new MessageAttachment('./src/assets/settings.png')],
        embeds: [
          new MessageEmbed({
            author: {
              name: `${interaction.guild}: Configuration`,
            },
            title: 'Game Configuration',
            description: [
              `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
              `**Game Role Color**: ${config.color ?? 'Not Set'}`,
              `**Game Invite Channel**: ${
                config.invite_channel
                  ? interaction.client.channels.cache.get(config.invite_channel)
                  : 'Not Set' ?? 'Invalid'
              }`,
              `**Game Role Mentionable**: ${config.mentionable ? 'True' : 'False'}`,
            ].join('\n'),
            footer: {
              text: 'Do `/config game update` to edit this configuration.',
            },
            thumbnail: { url: 'attachment://settings.png' },
            color: 'BLURPLE',
          }),
        ],
      });
    }
  }
}
