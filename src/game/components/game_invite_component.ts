import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  ButtonBuilder,
  GuildMember,
  SectionComponent,
} from 'discord.js';
import {
  ActivityType,
  TextDisplayComponent,
  type ContainerComponent,
  type MessageReplyOptions,
} from 'discord.js';
import type { GameInviteData } from '../../database/database_defs.js';
import { Constants, GameInviteComponents, QGConstants } from '../../misc/constants.js';
import Utils from '../../misc/utils.js';
import DatabaseFacade from '../../database/database_facade.js';
import { Component } from '../../interaction/modules/component.js';
import { client } from '../../main.js';
import GameManager from '../game_manager.js';

enum Id {
  Join = 'join',
  Leave = 'leave',
  Close = 'close',
  Notify = 'notify',
}

export default class GameInviteComponent extends Component {
  static createInteractable(data: Omit<GameInviteData, 'messageId'>): MessageReplyOptions {
    const guild = client.guilds.cache.get(data.guildId);
    const role = guild?.roles.cache.get(data.roleId);

    const container = new ContainerBuilder({
      id: GameInviteComponents.GAME_INVITE_CONTAINER,
    });

    const onlineMembers = role?.members.filter(m => m.presence && m.presence.status != 'offline');

    const header = [
      `# ${data.name}`,
      `-# ${data.id}`,
      '',
      `-# **Role**: ${Utils.mentionRoleById(data.roleId)}`,
      `-# **Player Count**: ${role?.members.size ?? 0} (${onlineMembers?.size ?? 0} online)`,
    ];

    if (data.time) {
      const startDate = Utils.addToDate(data.inviteDate, data.time, 'minutes');
      header.push(`-# **Start time**: ${startDate.toLocaleString()}`);
    }

    const headerSection = new SectionBuilder()
      .setId(GameInviteComponents.HEADER_SECTION)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setId(GameInviteComponents.HEADER_TEXT)
          .setContent(header.join('\n')),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(this.makeId(Id.Notify))
          .setEmoji('1368464152368123944')
          .setStyle(ButtonStyle.Secondary),
      );
    container.addSectionComponents(headerSection);

    container.addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Large));

    const inviter = role?.guild.members.cache.get(data.inviterId);
    const inviterInfo: string[] = ['## Inviter', Utils.mentionUserById(data.inviterId)];
    const inviterPresence = inviter?.presence?.activities
      .filter(a => a.type === ActivityType.Playing)
      .map(a => a.name);
    if (inviterPresence?.length) {
      inviterInfo.push(`-# **Now playing**: ${inviterPresence.join(', ')}`);
    }

    const inviterChannel = inviter?.voice.channel;
    if (inviterChannel) {
      inviterInfo.push(`-# **In voice**: ${inviterChannel}`);
    }

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(inviterInfo.join('\n')))
        .setThumbnailAccessory(builder =>
          builder.setURL(inviter?.displayAvatarURL() ?? guild?.iconURL()!),
        ),
    );

    let slotCount = data.joinersId.length;
    if (data.maxSlot && data.maxSlot - 1 > slotCount) slotCount = data.maxSlot - 1;

    for (let i = 0; i < slotCount; i++) {
      if (i >= GameManager.rsvpMax - 1) break;

      const joinerId = data.joinersId.at(i);

      const joinerInfo: string[] = [
        `## Player ${i + 2}`,
        joinerId ? Utils.mentionUserById(joinerId) : 'Slot Available',
      ];

      let joiner: GuildMember | undefined;
      if (joinerId) {
        joiner = role?.guild.members.cache.get(joinerId);

        const joinerPresence = joiner?.presence?.activities
          .filter(a => a.type === ActivityType.Playing)
          .map(a => a.name);
        if (joinerPresence?.length) {
          joinerInfo.push(`-# **Now playing**: ${joinerPresence.map(i => `**${i}**`).join(', ')}`);
        }

        const joinerChannel = joiner?.voice.channel;
        if (joinerChannel) {
          joinerInfo.push(`-# **In voice**: ${joinerChannel}`);
        }
      }

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(joinerInfo.join('\n')))
          .setThumbnailAccessory(builder =>
            builder.setURL(joiner?.displayAvatarURL() ?? guild?.iconURL()!),
          ),
      );
    }

    container.addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Large));

    container.addActionRowComponents(row =>
      row.addComponents([
        new ButtonBuilder()
          .setCustomId(this.makeId(Id.Join))
          .setLabel('Join')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(this.makeId(Id.Leave))
          .setLabel('Leave')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(this.makeId(Id.Close))
          .setLabel('Mark as Full')
          .setStyle(ButtonStyle.Secondary),
      ]),
    );

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: Id) {
    const db = DatabaseFacade.instance();

    if (!interaction.inGuild()) return;

    const container = interaction.message.components.find(
      c =>
        c.type === ComponentType.Container && c.id === GameInviteComponents.GAME_INVITE_CONTAINER,
    ) as ContainerComponent | undefined;
    if (!container) return;

    const headerSection = container.components.find(
      c => c.type === ComponentType.Section && c.id === GameInviteComponents.HEADER_SECTION,
    ) as SectionComponent | undefined;
    if (!headerSection) return;

    const headerText = headerSection.components.find(
      c => c.type === ComponentType.TextDisplay && c.id === GameInviteComponents.HEADER_TEXT,
    ) as TextDisplayComponent | undefined;

    const inviteId = headerText?.content.split('\n').at(1);
    if (!inviteId) return;

    const inviteData = await db.gameInviteData(Utils.removeLeadingWord(inviteId));
    if (!inviteData) return;

    const guild = client.guilds.cache.get(inviteData.guildId);
    if (guild?.id !== interaction.guildId) return;

    switch (customId) {
      case Id.Join:
        await this.join(interaction, inviteData);
        break;
      case Id.Leave:
        await this.leave(interaction, inviteData);
        break;
      case Id.Close:
        await this.close(interaction, inviteData);
        break;
      case Id.Notify:
        await this.notify(interaction, inviteData);
        break;
      default:
    }
  }

  async join(interaction: MessageComponentInteraction<CacheType>, data: GameInviteData) {
    const gm = GameManager.instance();

    if (data.inviterId === interaction.user.id) {
      return interaction.deferUpdate({ withResponse: false });
    }

    const willUpdate = !data.joinersId.some(joinerId => joinerId === interaction.user.id);
    if (willUpdate) data.joinersId.push(interaction.user.id);

    const reply = GameInviteComponent.createInteractable(data);
    await interaction.update({ components: reply.components });

    if (willUpdate) {
      const players = [data.inviterId, ...data.joinersId];
      for (const player of players.filter(player => player != interaction.user.id)) {
        try {
          const dmChannel = await interaction.guild?.members.cache.get(player)?.createDM();
          dmChannel?.send(
            `**${interaction.user.displayName}** joined the **${data.name}** game invite on **${interaction.guild}**.`,
          );
        } catch (_) {}
      }

      if (data.maxSlot && players.length >= data.maxSlot) {
        await gm.inviteOperator.closeGameInvite(data);
      }
    }
  }

  async leave(interaction: MessageComponentInteraction<CacheType>, data: GameInviteData) {
    if (data.inviterId === interaction.user.id) {
      return interaction.deferUpdate({ withResponse: false });
    }

    const willUpdate = data.joinersId?.some(joinerId => joinerId === interaction.user.id);
    if (willUpdate) {
      data.joinersId = data.joinersId.filter(joinerId => joinerId !== interaction.user.id);
    }

    const reply = GameInviteComponent.createInteractable(data);
    await interaction.update({ components: reply.components });

    if (willUpdate) {
      for (const player of [data.inviterId, ...data.joinersId]) {
        try {
          const dmChannel = await interaction.guild?.members.cache.get(player)?.createDM();
          dmChannel?.send(
            `**${interaction.user.displayName}** left the **${data.name}** game invite on **${interaction.guild}**.`,
          );
        } catch {}
      }
    }
  }

  async close(interaction: MessageComponentInteraction<CacheType>, data: GameInviteData) {
    if (data.inviterId !== interaction.user.id) {
      return interaction.reply({
        content: 'Only the inviter can close this invitation.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await GameManager.instance().inviteOperator.closeGameInvite(data);
  }

  async notify(interaction: MessageComponentInteraction<CacheType>, data: GameInviteData) {
    const member = interaction.member;
    if (!(member instanceof GuildMember)) return;

    const guild = client.guilds.cache.get(data.guildId);
    if (guild?.id !== interaction.guildId) return;

    const role = guild.roles.cache.get(data.roleId);
    if (!role) return;

    const channels = guild.channels.cache.filter(
      c =>
        c.parentId === QGConstants.DEDICATED_CHANNEL_CATEGORY_ID &&
        c.permissionsFor(role).has('ViewChannel'),
    );

    let content;
    if (member.roles.cache.has(role.id)) {
      content = [
        `You will no longer be notified when there is a game invite for ${role}.`,
        `However, this role will automatically be added to you once you play this game again.`,
      ];
      if (channels.size > 0) {
        content.push(
          `Also, you will no longer have access to the following channel: ${channels.map(c => c.toString()).join(', ')}`,
        );
      }

      await member.roles.remove(role, Constants.GAME_MANAGER_TITLE);
    } else {
      content = [`You will now be notified when there is a game invite for ${role}.`];
      if (channels.size > 0) {
        content.push(
          `Also, you now have access to the following channel: ${channels.map(c => c.toString()).join(', ')}`,
        );
      }

      await member.roles.add(role, Constants.GAME_MANAGER_TITLE);
    }

    await interaction.reply({
      content: content.join('\n'),
      flags: MessageFlags.Ephemeral,
    });
  }
}
