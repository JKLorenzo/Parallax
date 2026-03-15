import {
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  ContainerBuilder,
  ContainerComponent,
  MessageComponentInteraction,
  MessageFlags,
  SeparatorSpacingSize,
  TextDisplayComponent,
  type MessageReplyOptions,
} from 'discord.js';
import type { GuildInviteData } from '../../database/database_defs.js';
import { Component } from '../../interaction/modules/component.js';
import { GuildInviteComponents } from '../../misc/constants.js';
import DatabaseFacade from '../../database/database_facade.js';
import Utils from '../../misc/utils.js';

enum Id {
  Delete = 'delete',
}

export default class GuildInviteComponent extends Component {
  private static createBaseComponent(data: GuildInviteData) {
    const container = new ContainerBuilder({
      id: GuildInviteComponents.CONTAINER,
    });

    container.addTextDisplayComponents(b =>
      b.setContent(['### Gateway Manager', '**New Invite Created**'].join('\n')),
    );

    container.addTextDisplayComponents(b =>
      b.setId(GuildInviteComponents.INVITE_ID).setContent(`-# ${data.id}`),
    );

    const other_info = [`**Inviter**: ${Utils.mentionUserById(data.inviterId)}`];
    if (data.maxUses) {
      other_info.push(`**Max Uses**: ${data.maxUses}`);
    }
    if (data.expiresTimestamp) {
      other_info.push(`**Expires At**: ${new Date(data.expiresTimestamp)}`);
    }

    container.addTextDisplayComponents(b =>
      b.setId(GuildInviteComponents.INVITE_ID).setContent(other_info.join('\n')),
    );

    return container;
  }

  static createNewInvite(data: GuildInviteData): MessageReplyOptions {
    const container = this.createBaseComponent(data);

    container.addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Small));

    container.addActionRowComponents(row =>
      row.addComponents([
        new ButtonBuilder()
          .setCustomId(this.makeId(Id.Delete))
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),
      ]),
    );

    container.setAccentColor(Colors.Green);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }

  static createDeletedInvite(data: GuildInviteData): MessageReplyOptions {
    const container = this.createBaseComponent(data);

    if (data.uses) {
      container.addTextDisplayComponents(b => b.setContent(`**Uses**: ${data.uses}`));
    }

    container.setAccentColor(Colors.Fuchsia);

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }

  async exec(interaction: MessageComponentInteraction, customId: string) {
    const db = DatabaseFacade.instance();

    const guild = interaction.guild;
    if (!guild) return await interaction.reply('Failed to identify the guild for this invite.');

    const container = interaction.message.components.find(
      c => c.type === ComponentType.Container && c.id === GuildInviteComponents.CONTAINER,
    ) as ContainerComponent | undefined;
    if (!container)
      return await interaction.reply('Failed to identify the invite data for this interaction.');

    const headerText = container.components.find(
      c => c.type === ComponentType.TextDisplay && c.id === GuildInviteComponents.INVITE_ID,
    ) as TextDisplayComponent | undefined;

    const inviteId = headerText?.content.split('\n').at(1);
    if (!inviteId)
      return await interaction.reply('Failed to identify the invite ID for this interaction.');

    const inviteData = await db.guildInviteData(guild.id, Utils.removeLeadingWord(inviteId));
    if (!inviteData)
      return await interaction.reply('Failed to retrieve the invite data for this interaction.');

    switch (customId) {
      case Id.Delete:
        await db.deleteGuildInvite(guild.id, inviteData.id);

        await interaction.update({
          components: GuildInviteComponent.createDeletedInvite(inviteData).components,
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      default:
        await interaction.reply('Unknown action.');
    }
  }
}
