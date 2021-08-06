import { CommandInteraction, MessageAttachment, MessageEmbed } from 'discord.js';
import { getGameConfig, updateGameConfig } from '../modules/database.js';
import GlobalCommand from '../structures/command_global.js';
import { GameConfig } from '../utils/types.js';

export default class Config extends GlobalCommand {
  constructor() {
    super({
      name: 'config',
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
    if (!interaction.inGuild()) return;
    await interaction.defer({ ephemeral: true });

    if (interaction.options.getSubcommandGroup() === 'game') {
      let config = {} as GameConfig;
      if (interaction.options.getSubcommand() === 'get') {
        config = (await getGameConfig(interaction.guildId)) ?? {};
      } else {
        const enabled = interaction.options.getBoolean('enabled');
        const channel = interaction.options.getChannel('channel');
        const mentionable = interaction.options.getBoolean('mentionable');
        const color = interaction.options.getString('color');

        if (typeof enabled === 'boolean') config.enabled = enabled;
        if (typeof mentionable === 'boolean') config.mentionable = mentionable;
        if (channel) config.invite_channel = channel.id;
        if (color && /^[0-9A-F]{6}$/i.test(color)) config.color = `#${color}`;

        if (config) await updateGameConfig(interaction.guildId, config);
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
            thumbnail: { url: 'attachment://settings.png' },
            color: 'BLURPLE',
          }),
        ],
      });
    }
  }
}
