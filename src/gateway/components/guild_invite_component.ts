import {
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  ContainerBuilder,
  ContainerComponent,
  Guild,
  MessageComponentInteraction,
  MessageFlags,
  SectionBuilder,
  SectionComponent,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextDisplayComponent,
  ThumbnailBuilder,
  type MessageCreateOptions,
} from 'discord.js';
import type { GuildInviteData } from '../../database/database_defs.js';
import { Component } from '../../interaction/modules/component.js';
import { GuildInviteComponents } from '../../misc/constants.js';
import DatabaseFacade from '../../database/database_facade.js';
import Utils from '../../misc/utils.js';
import e from 'express';

enum Id {
  Delete = 'delete',
}

export enum InviteType {
  Create,
  Delete,
  DeleteOrExpired,
}

export default class GuildInviteComponent extends Component {
  private static createBaseComponent(guild: Guild, data: GuildInviteData, type: InviteType) {
    const container = new ContainerBuilder({
      id: GuildInviteComponents.CONTAINER,
    });

    const inviter = guild.members.cache.get(data.inviterId);

    const info = [
      `### Parallax Gatekeeper: ${guild.name}`,
      `**Invite ${type === InviteType.Create ? 'Created' : type === InviteType.Delete ? 'Deleted' : 'Expired or Deleted'}**`,
      '',
      `-# **Inviter**: ${Utils.mentionUserById(data.inviterId)}`,
      `-# **Invite Code**: ${data.id}`,
    ];

    if (data.uses) {
      info.push(`-# **Uses**: ${data.uses}`);
    }

    if (data.maxUses !== undefined) {
      info.push(`-# **Max Uses**: ${data.maxUses === 0 ? 'Unlimited' : data.maxUses}`);
    }

    if (type === InviteType.Create) {
      if (data.expiresTimestamp) {
        info.push(`-# **Expires At**: ${new Date(data.expiresTimestamp).toLocaleString()}`);
      }
    } else {
      if (data.createdTimestamp) {
        info.push(`-# **Created At**: ${new Date(data.createdTimestamp).toLocaleString()}`);
      }
    }

    container.addSectionComponents(
      new SectionBuilder()
        .setId(GuildInviteComponents.INFO_SECTION)
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setId(GuildInviteComponents.INFO_TEXT)
            .setContent(info.join('\n')),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(inviter?.displayAvatarURL() ?? guild?.iconURL()!),
        ),
    );

    container.setAccentColor(type === InviteType.Create ? Colors.Green : Colors.Fuchsia);

    return container;
  }

  static create(guild: Guild, data: GuildInviteData, type: InviteType): MessageCreateOptions {
    const container = this.createBaseComponent(guild, data, type);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }

  static createInteractive(
    guild: Guild,
    data: GuildInviteData,
    type: InviteType,
  ): MessageCreateOptions {
    const container = this.createBaseComponent(guild, data, type);

    container.addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Large));

    const rejectButton = new ButtonBuilder()
      .setCustomId(this.makeId(Id.Delete))
      .setLabel('Delete this invite')
      .setStyle(ButtonStyle.Secondary);

    container.addActionRowComponents(row => row.addComponents([rejectButton]));

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }

  async exec(interaction: MessageComponentInteraction, customId: string) {
    const guild = interaction.guild;
    if (!guild) return await interaction.reply('Failed to identify the guild for this invite.');

    const container = interaction.message.components.find(
      c => c.type === ComponentType.Container && c.id === GuildInviteComponents.CONTAINER,
    ) as ContainerComponent | undefined;
    if (!container)
      return await interaction.reply(
        'Failed to identify the component container for this interaction.',
      );

    const infoSection = container.components.find(
      c => c.type === ComponentType.Section && c.id === GuildInviteComponents.INFO_SECTION,
    ) as SectionComponent | undefined;
    if (!infoSection)
      return await interaction.reply(
        'Failed to identify the information section for this interaction.',
      );

    const infoText = infoSection.components.find(
      c => c.type === ComponentType.TextDisplay && c.id === GuildInviteComponents.INFO_TEXT,
    ) as TextDisplayComponent | undefined;
    if (!infoText)
      return await interaction.reply(
        'Failed to identify the text information for this interaction.',
      );

    const inviteCode = infoText?.content
      .split('\n')
      .find(t => Utils.hasAny(t, 'Invite Code'))
      ?.split(':')
      .at(1)
      ?.trim();

    if (!inviteCode)
      return await interaction.reply('Failed to identify the invite code for this interaction.');

    await interaction.deferReply();

    const invite = await guild.invites.fetch(inviteCode);

    switch (customId) {
      case Id.Delete:
        if (!invite)
          return await interaction.editReply(
            'This invite has already expired or has been deleted.',
          );

        await invite.delete().catch(() => null);
        await interaction.editReply(`This invite was successfully deleted by ${interaction.user}`);
        break;
      default:
        await interaction.editReply('Unknown action.');
    }
  }
}
