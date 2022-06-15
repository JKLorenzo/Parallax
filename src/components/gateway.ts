import { ButtonInteraction, GuildMember, Message, TextChannel } from 'discord.js';
import { getGatewayConfig, setMemberData } from '../modules/database.js';
import { addRole } from '../modules/role.js';
import Component from '../structures/component.js';
import { parseMention } from '../utils/functions.js';

export default class Gateway extends Component {
  constructor() {
    super({
      name: 'gateway',
      options: [
        {
          type: 'ACTION_ROW',
          components: [
            {
              customId: 'approve',
              label: 'Approve',
              type: 'BUTTON',
              style: 'SUCCESS',
            },
            {
              customId: 'kick',
              label: 'Deny (Kick)',
              type: 'BUTTON',
              style: 'PRIMARY',
            },
            {
              customId: 'ban',
              label: 'Ignore requests from this user (Ban)',
              type: 'BUTTON',
              style: 'DANGER',
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: ButtonInteraction, customId: string): Promise<void> {
    const guild = interaction.guild!;

    const config = await getGatewayConfig(guild.id);
    if (!config?.enabled || !config.role) return;

    const role = guild.roles.cache.get(config.role);
    if (!role) return;

    const message = interaction.message as Message;
    const embed = message.embeds[0];
    const member = guild.members.cache.get(parseMention(embed.fields[0].value));
    const moderator = interaction.member as GuildMember;

    if (member) {
      switch (customId) {
        case 'approve':
          await setMemberData(guild.id, {
            id: member.id,
            moderator: moderator.id,
            moderatorTag: moderator.user.tag,
          });
          await addRole(member, role);
          embed.fields[3].value = `Approved by ${moderator}`;
          embed.setColor('GREEN');
          break;
        case 'kick':
          await member.kick();
          embed.fields[3].value = `Kicked by ${moderator}`;
          embed.setColor('FUCHSIA');
          break;
        case 'ban':
          await member.ban({
            reason: `Gateway Ban by ${moderator.displayName}.`,
          });
          embed.fields[3].value = `Banned by ${moderator}`;
          embed.setColor('RED');
          break;
      }
    } else {
      embed.fields[3].value = 'User not found ⚠';
      embed.setColor('LUMINOUS_VIVID_PINK');
    }

    embed.setFooter({ text: new Date().toString() });

    await interaction.update({
      content: null,
      embeds: [embed],
      components: [],
    });

    const messages = await message.channel.messages.fetch();
    const ping_messages = messages.filter(
      msg => msg.content.startsWith(embed.fields[0].value) && msg.embeds.length === 0,
    );
    await (message.channel as TextChannel).bulkDelete(ping_messages);

    let feedback: string | undefined;
    if (customId === 'approve') {
      feedback = [
        `Hooraaay! 🥳 Your membership request has been approved! Welcome to **${guild.name}**!`,
        '',
        [
          'You can view the commands supported by this server by typing `/`',
          "in any of the server's text channels.",
        ].join(' '),
      ].join('\n');
    } else if (customId === 'kick') {
      feedback = `Sorry, it seems like your request to join the ${guild.name} server has been denied.`;
    } else if (customId === 'ban') {
      feedback = `Sorry, it seems like your request to join the ${guild.name} server has been denied indefinitely.`;
    }

    if (feedback) {
      await member?.send(feedback);
    }
  }
}
