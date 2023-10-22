import {
  ChatInputCommandInteraction,
  type CacheType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  GuildMember,
  ActivityType,
  type APIEmbedField,
  Colors,
} from 'discord.js';
import DatabaseFacade from '../../../../global/database/database_facade.js';
import type Bot from '../../../../modules/bot.js';
import Utils from '../../../../static/utils.js';
import { SlashCommand } from '../../command.js';
import { CommandScope } from '../../interaction_defs.js';

export default class InfoSlashCommand extends SlashCommand {
  constructor(bot: Bot) {
    super(
      bot,
      {
        name: 'info',
        description: 'Shows the current info of the selected user.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'user',
            description: 'Select the desired user.',
            type: ApplicationCommandOptionType.User,
            required: true,
          },
        ],
      },
      { scope: CommandScope.Guild },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const db = DatabaseFacade.instance();

    const guild = interaction.guild!;
    const member = interaction.options.getMember('user');

    if (!member || !(member instanceof GuildMember)) {
      return interaction.reply({
        content: 'User not found or is no longer a member of this guild.',
      });
    }

    const data = await db.memberData(guild.id, member.id);
    const inviter = data?.inviter ? guild.members.cache.get(data.inviter) : undefined;
    const moderator = data?.moderator ? guild.members.cache.get(data.moderator) : undefined;

    const user = await member.user.fetch();

    const fields: APIEmbedField[] = [
      {
        name: 'User ID:',
        value: user.id,
      },
      {
        name: 'Profile:',
        value: user.toString(),
      },
    ];

    const gatewayConfig = await db.gatewayConfig(guild.id);
    if (gatewayConfig?.enabled) {
      fields.push(
        {
          name: `Invited By: ${data?.inviterTag ? `(${data.inviterTag})` : ''}`,
          value: inviter?.toString() ?? 'N/A',
        },
        {
          name: `Moderated By: ${data?.moderatorTag ? `(${data.moderatorTag})` : ''}`,
          value: moderator?.toString() ?? 'N/A',
        },
      );
    }

    fields.push({
      name: 'Status:',
      value: Utils.toSelectiveUpper(member.presence?.status ?? 'Invisible or Offline'),
    });

    if (member.presence) {
      fields.push({
        name: 'Activities:',
        value: member.presence.activities
          .map(activity => {
            switch (activity.type) {
              case ActivityType.Competing:
                return `🔹Competing in ${activity.name} for ${
                  Utils.compareDate(activity.createdAt).humanized
                }`;
              case ActivityType.Listening:
                return `🔹Listening to ${activity.name} for ${
                  Utils.compareDate(activity.createdAt).humanized
                }`;
              case ActivityType.Playing:
                return `🔹Playing ${activity.name} for ${
                  Utils.compareDate(activity.createdAt).humanized
                }`;
              case ActivityType.Streaming:
                return `🔹Streaming ${activity.name} for ${
                  Utils.compareDate(activity.createdAt).humanized
                }`;
              case ActivityType.Watching:
                return `🔹Watching ${activity.name} for ${
                  Utils.compareDate(activity.createdAt).humanized
                }`;
              default:
                return `🔹Custom Status`;
            }
          })
          .join('\n'),
      });
    }

    const avatarURL = member.user.avatarURL();
    if (avatarURL) {
      fields.push({
        name: 'Avatar URL:',
        value: avatarURL,
      });
    }

    const bannerURL = member.user.bannerURL();
    if (bannerURL) {
      fields.push({
        name: 'Banner URL:',
        value: bannerURL,
      });
    }

    fields.push({
      name: `Account Created: (${Utils.compareDate(user.createdAt).humanized} ago)`,
      value: user.createdAt.toString(),
    });

    if (member.joinedAt) {
      fields.push({
        name: `Joined Guild: (${Utils.compareDate(member.joinedAt).humanized} ago)`,
        value: member.joinedAt.toString(),
      });
    }

    if (member.premiumSince) {
      fields.push({
        name: `Boosting Since: (${Utils.compareDate(member.premiumSince).humanized} ago)`,
        value: member.premiumSince.toString(),
      });
    }

    await interaction.reply({
      ephemeral: true,
      embeds: [
        {
          author: { name: `Parallax Snooper: ${guild.name}` },
          title: `${member.displayName} (${user.tag})`,
          thumbnail: { url: member.displayAvatarURL() },
          fields: fields,
          image: bannerURL ? { url: bannerURL } : undefined,
          footer: { text: `Information as of ${new Date()}` },
          color: Colors.Blurple,
        },
      ],
    });
  }
}
