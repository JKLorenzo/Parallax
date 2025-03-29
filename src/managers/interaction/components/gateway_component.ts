import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  ButtonStyle,
  Collection,
  Message,
  GuildMember,
  EmbedBuilder,
  Colors,
  type ActionRowData,
  type MessageActionRowComponentData,
} from 'discord.js';
import DatabaseFacade from '../../../global/database/database_facade.js';
import Utils from '../../../static/utils.js';
import Component from '../component.js';

enum Id {
  Approve = 'approve',
  Kick = 'kick',
  Ban = 'ban',
}

export default class GatewayComponent extends Component {
  static data(): ActionRowData<MessageActionRowComponentData>[] {
    return [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            customId: this.makeId(Id.Approve),
            label: 'Approve',
            type: ComponentType.Button,
            style: ButtonStyle.Success,
          },
          {
            customId: this.makeId(Id.Kick),
            label: 'Deny (Kick)',
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
          },
          {
            customId: this.makeId(Id.Ban),
            label: 'Ignore requests from this user (Ban)',
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
          },
        ],
      },
    ];
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: Id) {
    const db = DatabaseFacade.instance();

    const guild = interaction.guild;
    if (!guild) return;

    const config = await db.gatewayConfig(guild.id);
    if (!config?.enabled || !config.role) return;

    const role = guild.roles.cache.get(config.role);
    if (!role) return;

    const message = interaction.message;
    const embed = new EmbedBuilder(message.embeds[0].data);
    const memberId = Utils.parseMention(embed.data.fields?.at(0)?.value ?? '----');
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
    if (customId === Id.Approve) {
      feedback = [
        `Hooraaay! 🥳 Your membership request has been approved! Welcome to **${guild.name}**!`,
        '',
        [
          'You can view the commands supported by this server by typing `/`',
          "in any of the server's text channels.",
        ].join(' '),
      ].join('\n');
    } else if (customId === Id.Kick) {
      feedback = `Sorry, it seems like your request to join the ${guild.name} server has been denied.`;
    } else if (customId === Id.Ban) {
      feedback = `Sorry, it seems like your request to join the ${guild.name} server has been denied indefinitely.`;
    }

    if (member) {
      try {
        if (feedback) await member.send(feedback);
      } catch (_) {
        // Ignore if member doesn't accept messages
      }

      switch (customId) {
        case Id.Approve:
          await member.roles.add(role);
          await db.memberData(guild.id, member.id, {
            id: member.id,
            moderator: moderator.id,
            moderatorTag: moderator.user.tag,
          });
          embed
            .spliceFields(3, 1, { name: 'Status:', value: `Approved by ${moderator}` })
            .setColor(Colors.Green);
          break;
        case Id.Kick:
          await member.kick(`Gateway Kick by ${moderator.displayName}.`);
          embed
            .spliceFields(3, 1, { name: 'Status:', value: `Kicked by ${moderator}` })
            .setColor(Colors.Fuchsia);
          break;
        case Id.Ban:
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

    await interaction.update({
      content: null,
      embeds: [embed.setFooter({ text: new Date().toString() })],
      components: [],
    });
  }
}
