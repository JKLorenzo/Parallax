import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  MessageFlags,
  Colors,
  EmbedBuilder,
  ContainerBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ThumbnailBuilder,
  TextDisplayBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  ButtonBuilder,
  SectionComponent,
  Role,
} from 'discord.js';
import DatabaseFacade from '../../../global/database/database_facade.js';
import { ComponentV2 } from '../component.js';
import { Constants, GameInviteComponents } from '../../../static/constants.js';
import { type GameData, type GuildGameData } from '../../../global/database/database_defs.js';
import Utils from '../../../static/utils.js';
import Bot from '../../../modules/bot.js';
import {
  TextDisplayComponent,
  type ContainerComponent,
  type MessageReplyOptions,
} from 'discord.js';

enum CustomId {
  Join = 'join',
  Leave = 'leave',
  Close = 'close',
}

export default class GameInviteComponent extends ComponentV2 {
  static createInteractable(
    inviterId: string,
    data: GameData,
    guildData: GuildGameData,
    role: Role,
    joinerIds?: string[],
  ): MessageReplyOptions {
    const container = new ContainerBuilder({
      id: GameInviteComponents.GAME_INVITE_CONTAINER,
    });

    if (data.bannerURLs?.length && typeof data.bannerIndex === 'number') {
      const banner = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(data.bannerURLs[data.bannerIndex]),
      );
      container.addMediaGalleryComponents(banner);
    }

    const gameName = new TextDisplayBuilder()
      .setId(GameInviteComponents.GAME_NAME_TEXT)
      .setContent(`# ${data.name}`);

    const appId = new TextDisplayBuilder()
      .setId(GameInviteComponents.APP_ID_TEXT)
      .setContent(`-# ${data.id}`);

    const onlineMembers = role?.members.filter(m => m.presence?.status != 'offline');
    const gameInfo = new TextDisplayBuilder().setContent(
      [
        `-# **Player Count**: ${role?.members.size ?? 0} (${onlineMembers?.size ?? 0} online)`,
        `-# **Last Played**: ${guildData.lastPlayed ?? 'Not played yet'}`,
      ].join('\n'),
    );

    if (data.iconURLs?.length && typeof data.iconIndex === 'number') {
      const icon = new ThumbnailBuilder().setURL(data.iconURLs[data.iconIndex]);
      const section = new SectionBuilder()
        .setId(GameInviteComponents.HEADER_SECTION)
        .addTextDisplayComponents(gameName, appId, gameInfo)
        .setThumbnailAccessory(icon);
      container.addSectionComponents(section);
    } else {
      container.addTextDisplayComponents(gameName, appId, gameInfo);
    }

    container.addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Large));

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents([
          new TextDisplayBuilder().setContent('## Inviter'),
          new TextDisplayBuilder()
            .setId(GameInviteComponents.INVITER_TEXT)
            .setContent(Utils.mentionUserById(inviterId)),
        ])
        .setThumbnailAccessory(builder =>
          builder.setURL(role.guild.members.cache.get(inviterId)!.displayAvatarURL()),
        ),
    );

    if (joinerIds?.length) {
      for (let i = 0; i < joinerIds.length; i++) {
        container.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents([
              new TextDisplayBuilder().setContent(`## Player ${i + 2}`),
              new TextDisplayBuilder()
                .setId(GameInviteComponents.JOINER_TEXT_RANGE_START + i)
                .setContent(Utils.mentionUserById(joinerIds[i])),
            ])
            .setThumbnailAccessory(builder =>
              builder.setURL(role.guild.members.cache.get(joinerIds[i])!.displayAvatarURL()),
            ),
        );
      }
    }

    container.addSeparatorComponents(builder => builder.setSpacing(SeparatorSpacingSize.Large));

    container.addActionRowComponents(row =>
      row.addComponents([
        new ButtonBuilder()
          .setCustomId(this.makeId(CustomId.Join))
          .setLabel('Join')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(this.makeId(CustomId.Leave))
          .setLabel('Leave')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(this.makeId(CustomId.Close))
          .setLabel('Mark as Full / Cancel')
          .setStyle(ButtonStyle.Secondary),
      ]),
    );

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: CustomId) {
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

    const applicationIdComponent = (headerSection ?? container).components.find(
      c => c.type === ComponentType.TextDisplay && c.id === GameInviteComponents.APP_ID_TEXT,
    ) as TextDisplayComponent | undefined;
    if (!applicationIdComponent?.content) return;
    const applicationId = Utils.removeLeadingWord(applicationIdComponent.content);

    const inviterMentionComponent = container.components
      .filter(c => c.type === ComponentType.Section)
      .find(c => c.components.find(c => c.id === GameInviteComponents.INVITER_TEXT))
      ?.components.find(c => c.id === GameInviteComponents.INVITER_TEXT) as
      | TextDisplayComponent
      | undefined;

    if (!inviterMentionComponent?.content) return;

    const joinerIds: string[] = [];
    for (const section of container.components.filter(c => c.type === ComponentType.Section)) {
      const joinerMentionComponent = section.components.find(
        c => (c.id ?? 0) >= GameInviteComponents.JOINER_TEXT_RANGE_START,
      );
      if (!joinerMentionComponent?.content) continue;

      joinerIds.push(Utils.parseMention(joinerMentionComponent.content));
    }

    const gameData = await db.gameData(applicationId);
    if (!gameData) return;

    const guildGameData = await db.guildGameData(interaction.guildId, applicationId);
    if (!guildGameData) return;

    if (!guildGameData.roleId) return;

    const role = interaction.guild?.roles.cache.get(guildGameData.roleId);
    if (!role) return;

    const inviterId = Utils.parseMention(inviterMentionComponent.content);

    switch (customId) {
      case CustomId.Join:
        await this.join(interaction, inviterId, gameData, guildGameData, role, joinerIds);
        break;
      case CustomId.Leave:
        await this.leave(interaction, inviterId, gameData, guildGameData, role, joinerIds);
        break;
      case CustomId.Close:
        await this.close(interaction, inviterId, gameData, guildGameData, role, joinerIds);
        break;
      default:
    }
  }

  async join(
    interaction: MessageComponentInteraction<CacheType>,
    inviter: string,
    data: GameData,
    guildData: GuildGameData,
    role: Role,
    joinerIds: string[],
  ) {
    if (inviter === interaction.user.id) {
      return interaction.deferUpdate();
    }

    const willUpdate = !joinerIds.some(joinerId => joinerId === interaction.user.id);
    if (willUpdate) joinerIds.push(interaction.user.id);

    const reply = GameInviteComponent.createInteractable(inviter, data, guildData, role, joinerIds);
    await interaction.update({ components: reply.components });

    if (willUpdate) {
      for (const player of [inviter, ...joinerIds].filter(
        player => player != interaction.user.id,
      )) {
        try {
          const dmChannel = await interaction.guild?.members.cache.get(player)?.createDM();
          dmChannel?.send(
            `**${interaction.user.displayName}** joined the **${data.name}** game invite on **${interaction.guild}**.`,
          );
        } catch (_) {}
      }
    }
  }

  async leave(
    interaction: MessageComponentInteraction<CacheType>,
    inviter: string,
    data: GameData,
    guildData: GuildGameData,
    role: Role,
    joinerIds: string[],
  ) {
    if (inviter === interaction.user.id) {
      return interaction.deferUpdate();
    }

    const willUpdate = joinerIds.some(joinerId => joinerId === interaction.user.id);
    if (willUpdate) joinerIds = joinerIds.filter(joinerId => joinerId !== interaction.user.id);

    const reply = GameInviteComponent.createInteractable(inviter, data, guildData, role, joinerIds);
    await interaction.update({ components: reply.components });

    if (willUpdate) {
      for (const player of [inviter, ...joinerIds]) {
        try {
          const dmChannel = await interaction.guild?.members.cache.get(player)?.createDM();
          dmChannel?.send(
            `**${interaction.user.displayName}** left the **${data.name}** game invite on **${interaction.guild}**.`,
          );
        } catch {}
      }
    }
  }

  async close(
    interaction: MessageComponentInteraction<CacheType>,
    inviter: string,
    data: GameData,
    guildData: GuildGameData,
    role: Role,
    joinerIds: string[],
  ) {
    if (Utils.parseMention(inviter) !== interaction.user.id) {
      return interaction.reply({
        content: 'Only the inviter can close this invitation.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.message.delete();

    const inviteClosedEmbed = new EmbedBuilder({
      author: { name: Constants.GAME_MANAGER_TITLE },
      title: data.name,
      fields: [
        ...[inviter, ...joinerIds].map((players, i) => ({
          name: `Player ${i + 1}`,
          value: Utils.mentionUserById(players),
          inline: true,
        })),
      ],
      footer: { text: `${new Date()}` },
      color: Colors.Blurple,
    });

    if (data.iconURLs?.length && typeof data.iconIndex === 'number') {
      inviteClosedEmbed.setThumbnail(data.iconURLs[data.iconIndex]);
    }

    for (const player of [inviter, ...joinerIds]) {
      try {
        const dmChannel = await interaction.guild?.members.cache.get(player)?.createDM();
        dmChannel?.send({
          content: `The **${data.name}** party is now closed. Good luck!`,
          embeds: [inviteClosedEmbed],
        });
      } catch (_) {}
    }
  }
}
