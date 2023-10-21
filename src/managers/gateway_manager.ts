import {
  Collection,
  Colors,
  EmbedBuilder,
  Guild,
  GuildMember,
  Invite,
  type PartialGuildMember,
} from 'discord.js';
import type Bot from '../modules/bot.js';
import Queuer from '../modules/queuer.js';
import Utils from '../modules/utils.js';
import Manager from '../structures/manager.js';

export default class GatewayManager extends Manager {
  private cache: Collection<string, Collection<string, Invite>>;
  private queuer: Queuer;

  constructor(bot: Bot) {
    super(bot);

    this.cache = new Collection();
    this.queuer = new Queuer();
  }

  async init() {
    const { database } = this.bot.managers;
    const guilds: Guild[] = [];

    for (const guild of this.bot.client.guilds.cache.values()) {
      const config = await database.gatewayConfig(guild.id);
      if (!config?.enabled) continue;
      guilds.push(guild);
    }

    const invites = await Promise.all(guilds.map(g => g.invites.fetch()));

    invites.forEach(invite => {
      const guildId = invite.first()?.guild?.id;
      if (!guildId) return;
      this.cache.set(guildId, invite);
    });

    this.bot.client.on('inviteCreate', invite => {
      this.queuer.queue(() => this.onInviteCreate(invite));
    });

    this.bot.client.on('inviteDelete', invite => {
      this.queuer.queue(() => this.onInviteDelete(invite));
    });

    this.bot.client.on('guildMemberAdd', member => {
      this.queuer.queue(() => this.onMemberAdd(member));
    });

    this.bot.client.on('guildMemberUpdate', (oldMember, newMember) => {
      this.queuer.queue(() => this.onMemberUpdate(oldMember, newMember));
    });
  }

  private async onInviteCreate(invite: Invite) {
    const { database } = this.bot.managers;

    const guild = invite.guild;
    if (!guild) return;

    const config = await database.gatewayConfig(guild.id);
    if (!config?.enabled) return;

    const invites = this.cache.get(guild.id) ?? new Collection();
    invites.set(invite.code, invite);
    this.cache.set(guild.id, invites);
  }

  private async onInviteDelete(invite: Invite) {
    const { database } = this.bot.managers;

    const guild = invite.guild;
    if (!guild) return;

    const config = await database.gatewayConfig(guild.id);
    if (!config?.enabled) return;

    const invites = this.cache.get(guild.id);
    if (!invites) return;

    const cachedInvite = invites.get(invite.code);
    if (!cachedInvite) return;

    if (cachedInvite.maxUses !== 1 || Date.now() >= (cachedInvite.expiresTimestamp ?? 0)) {
      invites.delete(cachedInvite.code);
      this.cache.set(guild.id, invites);
    }
  }

  private async onMemberAdd(member: GuildMember) {
    const { database, interaction } = this.bot.managers;

    if (member.user.bot) return;

    const guild = member.guild;
    if (!guild) return;

    const config = await database.gatewayConfig(guild.id);
    if (!config?.enabled || !config.channel) return;
    const channel = guild.channels.cache.get(config.channel);
    if (!channel?.isTextBased()) return;

    const invites = this.cache.get(guild.id) ?? new Collection();
    const currentInvites = await guild.invites.fetch();
    const createdAt = member.user.createdAt;
    const messages = await channel.messages.fetch();

    const difference = currentInvites
      .difference(invites)
      .filter(i => (i.expiresTimestamp ?? 0) > Date.now() && i.maxUses === 1);

    let inviteUsed: Invite | undefined;

    if (difference.size === 1) {
      // Handles direct invites
      inviteUsed = difference.first()!;
      invites.delete(inviteUsed.code);
      this.cache.set(guild.id, invites);
    } else {
      // Handles guild-created invites
      for (const invite of currentInvites.values()) {
        const this_invite = invites.get(invite.code);

        if (Date.now() > (this_invite?.expiresTimestamp ?? 0)) {
          continue;
        }

        if ((invite.uses ?? 0) <= (this_invite?.uses ?? 0)) {
          continue;
        }

        inviteUsed = invite;

        invites.set(invite.code, inviteUsed);
        this.cache.set(guild.id, invites);
        break;
      }
    }

    let message = messages.find(thisMessage => {
      const thisMember = guild.members.cache.get(thisMessage.embeds[0]?.fields[0]?.value);
      return (
        thisMember?.id === member.id &&
        (thisMessage.embeds[0]?.fields[3]?.value === 'Pending' ||
          thisMessage.embeds[0]?.fields[3]?.value === 'Action Required')
      );
    });

    const inviter = inviteUsed?.inviter;

    await database.memberData(guild.id, member.id, {
      id: member.id,
      tag: member.user.tag,
      inviter: inviter?.id,
      inviterTag: inviter?.tag,
    });

    const embed = new EmbedBuilder({
      author: { name: `Parallax Gatekeeper: ${guild.name}` },
      title: 'Gateway Screening',
      thumbnail: { url: member.displayAvatarURL() },
      fields: [
        {
          name: `Profile: (${member.user.tag})`,
          value: member.toString(),
        },
        {
          name: `Inviter Profile: (${inviter?.tag ?? 'N\\A'})`,
          value: inviter?.toString() ?? 'No information',
        },
        {
          name: `Account Created: (${Utils.compareDate(createdAt).humanized} ago)`,
          value: new Date(createdAt).toString(),
        },
        { name: 'Status:', value: member.pending ? 'Pending' : 'Action Required' },
      ],
      footer: {
        text: member.pending
          ? 'Member must complete the membership verfication gate.'
          : 'Apply actions by clicking one of the buttons below.',
      },
      color: member.pending ? Colors.Blurple : Colors.Yellow,
    });

    if (message) {
      await message.edit({
        embeds: [embed],
        components: member.pending ? [] : interaction.componentData('gateway'),
      });
    } else {
      message = await channel.send({
        embeds: [embed],
        components: member.pending ? [] : interaction.componentData('gateway'),
      });
    }

    if (!member.pending) await message.reply(`${member} wants to join the server @here.`);

    try {
      await member.send({
        content:
          `Hey there, ${member}! **${guild.name}** uses a membership verification system. ` +
          'Please hang tight while the admins of this server reviews your membership application.',
      });
    } catch (_) {
      // Ignore if member doesn't accept messages
    }
  }

  private async onMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ) {
    const { database, interaction } = this.bot.managers;

    if (newMember.user.bot) return;
    if (newMember.pending) return;
    if (oldMember.pending === newMember.pending) return;

    const guild = newMember.guild;

    const config = await database.gatewayConfig(guild.id);
    if (!config?.enabled || !config.channel) return;
    const channel = guild.channels.cache.get(config.channel);
    if (!channel?.isTextBased()) return;

    const messages = await channel.messages.fetch();
    const message = messages.find(thisMessage => {
      const thisMember = guild.members.cache.get(
        Utils.parseMention(thisMessage.embeds[0]?.fields[0]?.value ?? ''),
      );
      return (
        thisMember?.id === newMember.id &&
        (thisMessage.embeds[0]?.fields[3]?.value === 'Pending' ||
          thisMessage.embeds[0]?.fields[3]?.value === 'Action Required')
      );
    });

    if (!message) return;

    const embed = new EmbedBuilder(message.embeds[0].data)
      .spliceFields(3, 1, { name: 'Status:', value: 'Action Required' })
      .setFooter({ text: 'Apply actions by clicking one of the buttons below.' })
      .setColor(Colors.Yellow);

    const action_message = await message.edit({
      embeds: [embed],
      components: interaction.componentData('gateway'),
    });

    await action_message.reply(
      `${newMember} completed the membership verification gate and is awating approval @here.`,
    );
  }
}
