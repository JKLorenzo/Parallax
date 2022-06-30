import { CommandInteraction, GuildMember } from 'discord.js';
import { getMemberData } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { compareDate, toSelectiveUpper } from '../../utils/functions.js';

export default class Info extends Command {
  constructor() {
    super(
      {
        name: 'info',
        description: 'Shows the current info of the selected user.',
        type: 'CHAT_INPUT',
        defaultPermission: true,
        options: [
          {
            name: 'user',
            description: 'Select the desired user.',
            type: 'USER',
            required: true,
          },
        ],
      },
      { scope: 'guild' },
    );
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const guild = interaction.guild!;
    const member = interaction.options.getMember('user', true);

    if (!member || !(member instanceof GuildMember)) {
      return interaction.reply({
        content: 'User not found or is no longer a member of this guild.',
      });
    }

    const data = await getMemberData(guild.id, member.id);
    const inviter = data?.inviter ? guild.members.cache.get(data.inviter) : undefined;
    const moderator = data?.moderator ? guild.members.cache.get(data.moderator) : undefined;

    const user = await member.user.fetch();

    await interaction.reply({
      ephemeral: true,
      embeds: [
        {
          author: { name: `Parallax Snooper: ${guild.name}` },
          title: `${member.displayName} (${user.tag})`,
          thumbnail: { url: member.displayAvatarURL() },
          fields: [
            {
              name: 'User ID:',
              value: user.id,
            },
            {
              name: 'Profile:',
              value: user.toString(),
            },
            {
              name: `Invited By: ${data?.inviterTag ? `(${data.inviterTag})` : ''}`,
              value: inviter?.toString() ?? 'N/A',
            },
            {
              name: `Moderated By: ${data?.moderatorTag ? `(${data.moderatorTag})` : ''}`,
              value: moderator?.toString() ?? 'N/A',
            },
            {
              name: 'Status:',
              value: toSelectiveUpper(member.presence?.status ?? 'Invisible or Offline'),
            },
            {
              name: 'Activities:',
              value:
                member.presence?.activities
                  .map(activity => {
                    switch (activity.type) {
                      case 'COMPETING':
                        return `🔹Competing in ${activity.name} for ${
                          compareDate(activity.createdAt).estimate
                        }`;
                      case 'LISTENING':
                        return `🔹Listening to ${activity.name} for ${
                          compareDate(activity.createdAt).estimate
                        }`;
                      case 'PLAYING':
                        return `🔹Playing ${activity.name} for ${
                          compareDate(activity.createdAt).estimate
                        }`;
                      case 'STREAMING':
                        return `🔹Streaming ${activity.name} for ${
                          compareDate(activity.createdAt).estimate
                        }`;
                      case 'WATCHING':
                        return `🔹Watching ${activity.name} for ${
                          compareDate(activity.createdAt).estimate
                        }`;
                      default:
                        return `🔹Custom Status: ${activity.name}`;
                    }
                  })
                  .join('\n') ?? 'N/A',
            },
            {
              name: 'Avatar URL:',
              value: user.avatarURL() ?? 'N/A',
            },
            {
              name: 'Banner URL:',
              value: user.bannerURL() ?? 'N/A',
            },
            {
              name: 'Guild Avatar URL:',
              value: member.displayAvatarURL(),
            },
            {
              name: `Account Created: (${compareDate(user.createdAt).estimate} ago)`,
              value: user.createdAt.toString(),
            },
            {
              name: `Joined Guild: ${
                member.joinedAt ? `(${compareDate(member.joinedAt).estimate} ago)` : 'N/A'
              }`,
              value: member.joinedAt?.toString() ?? 'N/A',
            },
            {
              name: `Boosting Since: ${
                member.premiumSince ? `(${compareDate(member.premiumSince).estimate} ago)` : ''
              }`,
              value: member.premiumSince?.toString() ?? 'N/A',
            },
          ],
          image: { url: user.bannerURL() ?? undefined },
          footer: { text: `${new Date()}` },
          color: 'BLURPLE',
        },
      ],
    });
  }
}
