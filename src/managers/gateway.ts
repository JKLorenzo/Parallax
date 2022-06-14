import { Collection, GuildMember, Invite, MessageEmbed, PartialGuildMember } from 'discord.js';
import { getComponent } from './interaction.js';
import { client } from '../main.js';
import { getGatewayConfig, setMemberData } from '../modules/database.js';
import { compareDate, parseMention } from '../utils/functions.js';
import { Queuer } from '../utils/queuer.js';

const queuer = new Queuer();
const _invites = new Collection<string, Collection<string, Invite>>();

export async function initGateway(): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const config = await getGatewayConfig(guild.id);
    if (!config?.enabled) continue;

    const invites = await guild.invites.fetch();
    _invites.set(guild.id, invites);
  }

  client.on('inviteCreate', invite => {
    queuer.queue(async () => {
      await processInviteCreate(invite);
    });
  });

  client.on('inviteDelete', invite => {
    queuer.queue(async () => {
      await processInviteDelete(invite);
    });
  });

  client.on('guildMemberAdd', member => {
    queuer.queue(async () => {
      await processMemberAdd(member);
    });
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    queuer.queue(async () => {
      await processMemberUpdate(oldMember, newMember);
    });
  });
}

async function processInviteCreate(invite: Invite): Promise<void> {
  const guild = invite.guild!;
  const config = await getGatewayConfig(guild.id);
  if (!config?.enabled) return;

  const invites = _invites.get(guild.id) ?? new Collection();
  invites.set(invite.code, invite);
  _invites.set(guild.id, invites);
}

async function processInviteDelete(invite: Invite): Promise<void> {
  const guild = invite.guild!;
  const config = await getGatewayConfig(guild.id);
  if (!config?.enabled) return;

  const invites = _invites.get(invite.guild!.id);
  if (!invites) return;

  if (invites.get(invite.code)) invite = invites.get(invite.code)!;

  if (invite.maxUses !== 1 || Date.now() >= (invite.expiresTimestamp ?? 0)) {
    invites.delete(invite.code);
    _invites.set(guild.id, invites);
  }
}

async function processMemberAdd(member: GuildMember): Promise<void> {
  if (member.user.bot) return;

  const guild = member.guild;
  const config = await getGatewayConfig(guild.id);
  if (!config?.enabled || !config.channel) return;
  const channel = guild.channels.cache.get(config.channel);
  if (!channel || !channel.isText()) return;
  const invites = _invites.get(guild.id) ?? new Collection();
  const currentInvites = await guild.invites.fetch();
  const createdAt = member.user.createdAt;
  const messages = await channel.messages.fetch();

  const difference = currentInvites
    .difference(invites)
    .filter(i => (i.expiresTimestamp ?? 0) > Date.now() && i.maxUses === 1);

  let inviteUsed: Invite | undefined;

  if (difference.size === 1) {
    inviteUsed = difference.first()!;
    invites.delete(inviteUsed.code);
  } else {
    for (const invite of currentInvites.values()) {
      const this_invite = invites.get(invite.code);
      if (!this_invite || (this_invite && Date.now() > (this_invite.expiresTimestamp ?? 0))) {
        continue;
      }
      if ((invite.uses ?? 0) <= (this_invite.uses ?? 0)) {
        continue;
      }
      inviteUsed = invite;
      break;
    }
  }

  const message = messages.find(thisMessage => {
    const thisMember = guild.members.cache.get(thisMessage.embeds[0]?.fields[0]?.value);
    return (
      thisMember?.id === member.id &&
      (thisMessage.embeds[0]?.fields[3]?.value === 'Pending' ||
        thisMessage.embeds[0]?.fields[3]?.value === 'Action Required')
    );
  });

  const inviter = inviteUsed?.inviter;

  await setMemberData(guild.id, {
    id: member.id,
    tag: member.user.tag,
    inviter: inviter?.id,
    inviterTag: inviter?.tag,
  });

  const embed = new MessageEmbed({
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
        name: `Account Created: (${compareDate(createdAt).estimate} ago)`,
        value: new Date(createdAt).toString(),
      },
      { name: 'Status:', value: member.pending ? 'Pending' : 'Action Required' },
    ],
    footer: {
      text: member.pending
        ? 'Member must complete the membership verfication gate.'
        : 'Apply actions by clicking one of the buttons below.',
    },
    color: member.pending ? 'BLURPLE' : 'YELLOW',
  });

  if (message) {
    await message.edit({
      content: member.pending
        ? null
        : `${member} completed the membership verification gate and is awaiting approval. @here`,
      embeds: [embed],
      components: member.pending ? [] : getComponent('gateway'),
    });
  } else {
    await channel.send({
      content: member.pending
        ? undefined
        : `${member} completed the membership verification gate and is awaiting approval. @here`,
      embeds: [embed],
      components: member.pending ? [] : getComponent('gateway'),
    });
  }

  if (!member.pending) {
    await member.send({
      content:
        `Hey there, ${member}! **${guild.name}** uses a membership verification system. ` +
        'Please hang tight while the admins of this server reviews your membership application.',
    });
  }
}

async function processMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): Promise<void> {
  if (newMember.user.bot) return;
  if (newMember.pending) return;
  if (oldMember.pending === newMember.pending) return;

  const guild = newMember.guild;
  const config = await getGatewayConfig(guild.id);
  if (!config?.enabled || !config.channel) return;
  const channel = guild.channels.cache.get(config.channel);
  if (!channel || !channel.isText()) return;

  const messages = await channel.messages.fetch();
  const message = messages.find(thisMessage => {
    const thisMember = guild.members.cache.get(
      parseMention(thisMessage.embeds[0]?.fields[0]?.value ?? ''),
    );
    return (
      thisMember?.id === newMember.id &&
      (thisMessage.embeds[0]?.fields[3]?.value === 'Pending' ||
        thisMessage.embeds[0]?.fields[3]?.value === 'Action Required')
    );
  });

  if (!message) return;

  const embed = message.embeds[0];
  embed.fields[3].value = 'Action Required';
  embed.setFooter({ text: 'Apply actions by clicking one of the buttons below.' });
  embed.setColor('YELLOW');

  const action_message = await message.edit({
    content: null,
    embeds: [embed],
    components: getComponent('gateway'),
  });

  await action_message.reply({
    content: `${newMember} wants to join the server, @here.`,
    allowedMentions: {
      parse: ['everyone'],
    },
  });

  await newMember.send({
    content:
      `Hey there, ${newMember}! **${guild.name}** uses a membership verification system. ` +
      'Please hang tight while the admins of this server reviews your membership application.',
  });
}
