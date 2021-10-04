import {
  CommandInteraction,
  Guild,
  GuildMember,
  MessageAttachment,
  MessageButton,
  MessageEmbed,
  Permissions,
  TextChannel,
} from 'discord.js';
import { client } from '../../main.js';
import { getComponent } from '../../managers/interaction.js';
import {
  getFreeGameConfig,
  getGameConfig,
  getPlayConfig,
  updateFreeGameConfig,
  updateGameConfig,
  updatePlayConfig,
} from '../../modules/database.js';
import Command from '../../structures/command.js';
import { hasAny } from '../../utils/functions.js';
import { FreeGameConfig, GameConfig, PlayConfig } from '../../utils/types.js';

export default class GuildConfig extends Command {
  constructor() {
    super('guild', {
      name: 'guildconfig',
      description: 'Gets or updates the configuration of this server.',
      type: 'CHAT_INPUT',
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
              name: 'role_reference',
              description: 'The reference role to be used for positioning.',
              type: 'ROLE',
            },
          ],
        },
        {
          name: 'free_game',
          description: 'Gets or updates the free game configuration of this server.',
          type: 'SUB_COMMAND',
          options: [
            {
              name: 'show_options',
              description: 'Sends the role selection pane to this channel.',
              type: 'CHANNEL',
            },
            {
              name: 'enabled',
              description: 'Enable or disable this config.',
              type: 'BOOLEAN',
            },
            {
              name: 'channel',
              description: 'The channel where free games will be sent.',
              type: 'CHANNEL',
            },
            {
              name: 'steam',
              description: 'The role to mention when theres a free game on Steam.',
              type: 'ROLE',
            },
            {
              name: 'epic',
              description: 'The role to mention when theres a free game on Epic Games.',
              type: 'ROLE',
            },
            {
              name: 'gog',
              description: 'The role to mention when theres a free game on GOG.',
              type: 'ROLE',
            },
            {
              name: 'ps',
              description: 'The role to mention when theres a free game for PlayStation.',
              type: 'ROLE',
            },
            {
              name: 'xbox',
              description: 'The role to mention when theres a free game for Xbox.',
              type: 'ROLE',
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: CommandInteraction): Promise<unknown> {
    const member = interaction.member as GuildMember;
    const command = interaction.options.getSubcommand();
    const guild = client.guilds.cache.get(interaction.guildId!) as Guild;

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
      title: `${command
        .split('_')
        .map(c => `${c.charAt(0).toUpperCase()}${c.slice(1)}`)
        .join(' ')} Configuration`,
      footer: {
        text: `Do \`/guildconfig ${command}\` to edit this configuration.`,
      },
      thumbnail: { url: 'attachment://settings.png' },
      color: 'BLURPLE',
    });

    if (command === 'game') {
      const data = {} as GameConfig;
      const config = (await getGameConfig(guild.id)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const mentionable = interaction.options.getBoolean('mentionable');
      const channel = interaction.options.getChannel('invite_channel');
      const role = interaction.options.getRole('role_reference');

      if (typeof mentionable === 'boolean') config.mentionable = data.mentionable = mentionable;
      if (channel) config.invite_channel = data.invite_channel = channel.id;
      if (role) config.reference_role = data.reference_role = role.id;

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.mentionable = data.mentionable = undefined;
          config.invite_channel = data.invite_channel = undefined;
          config.reference_role = data.reference_role = undefined;
        }
      }

      if (data) await updateGameConfig(guild.id, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Mentionable**: ${config.mentionable ? 'True' : 'False'}`,
          `**Invite Channel**: ${
            config.invite_channel
              ? guild.channels.cache.get(config.invite_channel)
              : 'Not Set' ?? 'Invalid'
          }`,
          `**Role Reference**: ${
            config.reference_role
              ? guild.roles.cache.get(config.reference_role)
              : 'Not Set' ?? 'Invalid'
          }`,
        ].join('\n'),
      );
    } else if (command === 'play') {
      const data = {} as PlayConfig;
      const config = (await getPlayConfig(guild.id)) ?? {};

      const enabled = interaction.options.getBoolean('enabled');
      const hoisted = interaction.options.getBoolean('hoisted');
      const mentionable = interaction.options.getBoolean('mentionable');
      const role = interaction.options.getRole('role_reference');

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (typeof hoisted === 'boolean') config.hoisted = data.hoisted = hoisted;
      if (typeof mentionable === 'boolean') config.mentionable = data.mentionable = mentionable;
      if (role) config.reference_role = data.reference_role = role.id;

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.hoisted = data.hoisted = undefined;
          config.mentionable = data.mentionable = undefined;
          config.reference_role = data.reference_role = undefined;
        }
      }

      if (data) await updatePlayConfig(guild.id, data);

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Hoisted**: ${config.hoisted ? 'True' : 'False'}`,
          `**Mentionable**: ${config.mentionable ? 'True' : 'False'}`,
          `**Role Reference**: ${
            config.reference_role
              ? guild.roles.cache.get(config.reference_role)
              : 'Not Set' ?? 'Invalid'
          }`,
        ].join('\n'),
      );
    } else if (command === 'free_game') {
      const data = {} as FreeGameConfig;
      const config = (await getFreeGameConfig(guild.id)) ?? {};

      const show_options = interaction.options.getChannel('show_options');

      const enabled = interaction.options.getBoolean('enabled');
      const channel = interaction.options.getChannel('channel');
      const steam_role = interaction.options.getRole('steam');
      const epic_role = interaction.options.getRole('epic');
      const gog_role = interaction.options.getRole('gog');
      const ps_role = interaction.options.getRole('ps');
      const xbox_role = interaction.options.getRole('xbox');

      if (channel && channel.type !== 'GUILD_TEXT') {
        return interaction.editReply(
          `The selected channel ${channel} is not a text-based channel.`,
        );
      }

      if (typeof enabled === 'boolean') config.enabled = data.enabled = enabled;
      if (channel) config.channel = data.channel = channel.id;
      if (steam_role) config.steam_role = data.steam_role = steam_role.id;
      if (epic_role) config.epic_role = data.epic_role = epic_role.id;
      if (gog_role) config.gog_role = data.gog_role = gog_role.id;
      if (ps_role) config.ps_role = data.ps_role = ps_role.id;
      if (xbox_role) config.xbox_role = data.xbox_role = xbox_role.id;

      if (typeof enabled === 'boolean') {
        if (enabled) {
          config.enabled = data.enabled = true;
        } else {
          config.enabled = data.enabled = false;
          config.channel = data.channel = undefined;
          config.steam_role = data.steam_role = undefined;
          config.epic_role = data.epic_role = undefined;
          config.gog_role = data.gog_role = undefined;
          config.ps_role = data.ps_role = undefined;
          config.xbox_role = data.xbox_role = undefined;
        }
      }

      if (data) await updateFreeGameConfig(guild.id, data);

      if (show_options) {
        if (!config.channel) {
          return interaction.editReply('Invalid config: `channel` option is not set.');
        }

        const free_game_channel = guild.channels.cache.get(config.channel);
        if (!free_game_channel) {
          return interaction.editReply('Invalid config: `channel` option is no longer valid.');
        }

        if (show_options.type !== 'GUILD_TEXT') {
          return interaction.editReply(
            `The selected channel (${show_options}) is not a text-based channel. ${
              data ? 'All changes are saved.' : ''
            }`,
          );
        }

        const role_descriptions = [] as string[];
        if (config.steam_role) {
          const steam = guild.roles.cache.get(config.steam_role);
          const steam_emoji = client.emojis.cache.find(e => e.name === 'steam');
          if (steam) {
            role_descriptions.push(`**${steam_emoji} - Steam (${steam})**`);
            role_descriptions.push('Notifies you with games that are currently free on Steam.\n');
          }
        }
        if (config.epic_role) {
          const epic = guild.roles.cache.get(config.epic_role);
          const epic_emoji = client.emojis.cache.find(e => e.name === 'epic');
          if (epic) {
            role_descriptions.push(`**${epic_emoji} - Epic Games (${epic})**`);
            role_descriptions.push(
              'Notifies you with games that are currently free on Epic Games.\n',
            );
          }
        }
        if (config.gog_role) {
          const gog = guild.roles.cache.get(config.gog_role);
          const gog_emoji = client.emojis.cache.find(e => e.name === 'gog');
          if (gog) {
            role_descriptions.push(`**${gog_emoji} - GOG (${gog})**`);
            role_descriptions.push('Notifies you with games that are currently free on GOG.\n');
          }
        }
        if (config.ps_role) {
          const ps = guild.roles.cache.get(config.ps_role);
          const ps_emoji = client.emojis.cache.find(e => e.name === 'ps');
          if (ps) {
            role_descriptions.push(`**${ps_emoji} - PlayStation (${ps})**`);
            role_descriptions.push(
              'Notifies you with games that are currently free on PlayStation.\n',
            );
          }
        }
        if (config.xbox_role) {
          const xbox = guild.roles.cache.get(config.xbox_role);
          const xbox_emoji = client.emojis.cache.find(e => e.name === 'xbox');
          if (xbox) {
            role_descriptions.push(`**${xbox_emoji} - Xbox (${xbox})**`);
            role_descriptions.push('Notifies you with games that are currently free on Xbox.\n');
          }
        }

        if (role_descriptions.length === 0) {
          return interaction.editReply(
            'At least one configured platform is required to perform this action.',
          );
        }

        await (show_options as TextChannel).send({
          files: [new MessageAttachment('./src/assets/gaming.gif')],
          embeds: [
            new MessageEmbed({
              author: { name: `${guild.name}: Role Selection Pane` },
              title: 'Free Game Updates',
              description: [
                `All notifications will be made available on ${free_game_channel} channel. ` +
                  `Powered by ${client.emojis.cache.find(
                    e => e.name === 'reddit',
                  )} [r/FreeGameFindings](https://www.reddit.com/r/FreeGameFindings/).`,
                '',
                ...role_descriptions,
              ].join('\n'),
              image: {
                url: 'attachment://gaming.gif',
              },
              footer: { text: 'Update your role by interacting with the buttons below.' },
              color: 'GREEN',
            }),
          ],
          components: getComponent('free_games')?.map(options => ({
            ...options,
            components: options.components.filter(component => {
              if (component instanceof MessageButton) {
                if (!component.emoji?.id || !hasAny(role_descriptions.join(), component.emoji.id)) {
                  return false;
                }
              }
              return true;
            }),
          })),
        });
      }

      embed.setDescription(
        [
          `**Enabled**: ${config.enabled ? 'True' : 'False'}`,
          `**Channel**: ${
            config.channel ? guild.channels.cache.get(config.channel) : 'Not Set' ?? 'Invalid'
          }`,
          `**Steam**: ${
            config.steam_role ? guild.roles.cache.get(config.steam_role) : 'Not Set' ?? 'Invalid'
          }`,
          `**Epic Games**: ${
            config.epic_role ? guild.roles.cache.get(config.epic_role) : 'Not Set' ?? 'Invalid'
          }`,
          `**GOG**: ${
            config.gog_role ? guild.roles.cache.get(config.gog_role) : 'Not Set' ?? 'Invalid'
          }`,
          `**PlayStation**: ${
            config.ps_role ? guild.roles.cache.get(config.ps_role) : 'Not Set' ?? 'Invalid'
          }`,
          `**Xbox**: ${
            config.xbox_role ? guild.roles.cache.get(config.xbox_role) : 'Not Set' ?? 'Invalid'
          }`,
        ].join('\n'),
      );
    }

    if (embed.description) {
      await interaction.editReply({
        files: [new MessageAttachment('./src/assets/settings.png')],
        embeds: [embed],
      });
    }
  }
}
