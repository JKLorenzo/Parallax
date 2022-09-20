import {
  ChatInputCommandInteraction,
  CacheType,
  PermissionFlagsBits,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ChannelType,
  EmbedBuilder,
  Colors,
  AttachmentBuilder,
} from 'discord.js';
import type Bot from '../../../modules/bot.js';
import { CommandScope } from '../../../schemas/enums.js';
import type { MusicConfig } from '../../../schemas/types.js';
import SlashCommand from '../../../structures/command_slash.js';

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
    const { database } = this.bot.managers;
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
      const config = (await database.musicConfig(guild.id)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (channel) config.channel = data.channel = channel.id;

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.channel = data.channel = undefined;
        }
      }

      await database.musicConfig(guild.id, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Music Channel**: ${
            config.channel ? guild.channels.cache.get(config.channel) : 'Not Set' ?? 'Invalid'
          }`,
        ].join('\n'),
      );
    }

    await interaction.editReply({
      embeds: [embed],
      files: [new AttachmentBuilder('./src/assets/settings.png')],
    });
  }
}
