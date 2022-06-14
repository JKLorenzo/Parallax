import { CommandInteraction, GuildMember } from 'discord.js';
import { getMemberData } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { compareDate, toSelectiveUpper } from '../../utils/functions.js';

export default class Stats extends Command {
  constructor() {
    super(
      {
        name: 'stats',
        description: 'Shows the current stats of the selected target.',
        type: 'CHAT_INPUT',
        defaultPermission: true,
        options: [
          {
            name: 'bot',
            description: 'Shows the current stats of this bot.',
            type: 'SUB_COMMAND',
          },
          {
            name: 'user',
            description: 'Shows the current stats of the selected user.',
            type: 'SUB_COMMAND',
            options: [
              {
                name: 'user',
                description: 'Select the desired user.',
                type: 'USER',
                required: true,
              },
            ],
          },
        ],
      },
      { scope: 'guild' },
    );
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const command = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    let target;
    if (command === 'bot') {
      target = guild.me!;
    } else if (command === 'user') {
      target = interaction.options.getMember('user');
    }

    if (!target || !(target instanceof GuildMember)) {
      return interaction.reply({
        content: 'User not found or is no longer a member of this guild.',
      });
    }

    const data = await getMemberData(guild.id, target.id);
    const inviter = data?.inviter ? guild.members.cache.get(data.inviter) : undefined;
    const moderator = data?.moderator ? guild.members.cache.get(data.moderator) : undefined;

    const user = await target.user.fetch();

    await interaction.reply({
      ephemeral: true,
      embeds: [
        {
          author: { name: `Parallax Snooper: ${guild.name}` },
          title: `${target.displayName} (${target.user.tag})`,
          thumbnail: { url: target.displayAvatarURL() },
          fields: [
            {
              name: 'User ID:',
              value: target.id,
            },
            {
              name: 'Profile:',
              value: target.toString(),
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
              value: toSelectiveUpper(target.presence?.status ?? 'Invisible or Offline'),
            },
            {
              name: 'Activities:',
              value:
                target.presence?.activities
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
              value: target.displayAvatarURL(),
            },
            {
              name: `Account Created: (${compareDate(user.createdAt).estimate} ago)`,
              value: user.createdAt.toString(),
            },
            {
              name: `Joined Guild: (${compareDate(target.joinedAt!).estimate} ago)`,
              value: target.joinedAt!.toString(),
            },
            {
              name: `Boosting Since: ${
                target.premiumSince ? `(${compareDate(target.premiumSince).estimate} ago)` : ''
              }`,
              value: target.premiumSince?.toString() ?? 'N/A',
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
