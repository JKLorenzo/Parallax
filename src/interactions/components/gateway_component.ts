import {
  MessageComponentInteraction,
  CacheType,
  ComponentType,
  ButtonStyle,
  Collection,
  Message,
  GuildMember,
  EmbedBuilder,
  Colors,
} from 'discord.js';
import type Bot from '../../modules/bot.js';
import Component from '../../structures/component.js';

export default class GatewayComponent extends Component {
  constructor(bot: Bot) {
    super(bot, {
      name: 'gateway',
      data: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              customId: 'approve',
              label: 'Approve',
              type: ComponentType.Button,
              style: ButtonStyle.Success,
            },
            {
              customId: 'kick',
              label: 'Deny (Kick)',
              type: ComponentType.Button,
              style: ButtonStyle.Primary,
            },
            {
              customId: 'ban',
              label: 'Ignore requests from this user (Ban)',
              type: ComponentType.Button,
              style: ButtonStyle.Danger,
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: string) {
    const { database } = this.bot.managers;
    const { parseMention } = this.bot.utils;

    const guild = interaction.guild;
    if (!guild) return;

    const config = await database.gatewayConfig(guild.id);
    if (!config?.enabled || !config.role) return;

    const role = guild.roles.cache.get(config.role);
    if (!role) return;

    const message = interaction.message;
    const embed = new EmbedBuilder(message.embeds[0].data);
    const memberId = parseMention(embed.data.fields?.at(0)?.value ?? '----');
    const member = guild.members.cache.get(memberId);
    const moderator = interaction.member as GuildMember;
    const messages = await message.channel.messages.fetch();
    const pingMessages = (messages as Collection<string, Message>).filter(
      msg => msg.content.startsWith(memberId) && msg.embeds.length === 0,
    );

    if (message.channel.isTextBased() && !message.channel.isDMBased()) {
      message.channel.bulkDelete(pingMessages);
    }

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

    if (member) {
      switch (customId) {
        case 'approve':
          await member.roles.add(role);
          await database.memberData(guild.id, member.id, {
            id: member.id,
            moderator: moderator.id,
            moderatorTag: moderator.user.tag,
          });
          embed
            .spliceFields(3, 1, { name: 'Status:', value: `Approved by ${moderator}` })
            .setColor(Colors.Green);
          break;
        case 'kick':
          await member.kick(`Gateway Kick by ${moderator.displayName}.`);
          embed
            .spliceFields(3, 1, { name: 'Status:', value: `Kicked by ${moderator}` })
            .setColor(Colors.Fuchsia);
          break;
        case 'ban':
          await member.ban({ reason: `Gateway Ban by ${moderator.displayName}.` });
          embed
            .spliceFields(3, 1, { name: 'Status:', value: `Banned by ${moderator}` })
            .setColor(Colors.Red);
          break;
      }
    } else {
      embed
        .spliceFields(3, 1, { name: 'Status:', value: 'User not found' })
        .setColor(Colors.LuminousVividPink);
    }

    if (feedback) await member?.send(feedback);

    await interaction.update({
      content: null,
      embeds: [embed.setFooter({ text: new Date().toString() })],
      components: [],
    });
  }
}
