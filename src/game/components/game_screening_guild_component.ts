import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  ButtonStyle,
  type ActionRowData,
  type MessageActionRowComponentData,
  Role,
} from 'discord.js';
import DatabaseFacade from '../../database/database_facade.js';
import { Constants } from '../../misc/constants.js';
import { GameStatus, type GuildGameData } from '../../database/database_defs.js';
import GameManager from '../../game/game_manager.js';
import { Component } from '../../modules/component.js';

enum Id {
  Approve = 'approve',
  Deny = 'deny',
  Refresh = 'refresh',
}

export default class GameScreeningGuildComponent extends Component {
  static data(): ActionRowData<MessageActionRowComponentData>[] {
    return [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            customId: this.makeId(Id.Approve),
            label: 'Approve',
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
          },
          {
            customId: this.makeId(Id.Deny),
            label: 'Deny',
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
          },
          {
            customId: this.makeId(Id.Refresh),
            label: 'Refresh',
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
          },
        ],
      },
    ];
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: Id) {
    const db = DatabaseFacade.instance();

    const guild = interaction.guild;
    if (!guild) return;

    const applicationId = interaction.message.embeds
      .find(embed => embed.author?.name === Constants.GAME_MANAGER_TITLE)
      ?.fields.find(field => field.name === Constants.GAME_EMBED_APPID_FIELD)?.value;
    if (!applicationId) return;

    const gameData = await db.gameData(applicationId);
    if (!gameData) return;

    const guildGameData = await db.guildGameData(guild.id, applicationId);
    if (!guildGameData) return;

    switch (customId) {
      case Id.Approve:
        await this.approve(interaction, applicationId);
        break;
      case Id.Deny:
        await this.deny(interaction, applicationId);
        break;
      case Id.Refresh:
        await this.refresh(interaction, applicationId);
        break;
      default:
    }
  }

  async approve(interaction: MessageComponentInteraction<CacheType>, applicationId: string) {
    const db = DatabaseFacade.instance();
    const gm = GameManager.instance();

    const guild = interaction.guild;
    if (!guild) return;

    const config = await db.gameConfig(guild.id);
    if (!config?.enabled) return;

    const gameData = await db.gameData(applicationId);
    if (!gameData) return;

    let guildGameData = await db.guildGameData(guild.id, applicationId);
    if (!guildGameData) return;

    let role: Role | undefined;
    if (!guildGameData.roleId || !guild.roles.cache.get(guildGameData.roleId)) {
      let referenceRole: Role | undefined;
      if (config.role) referenceRole = guild.roles.cache.get(config.role);

      try {
        role = await guild.roles.create({
          name: gameData.name,
          color: referenceRole?.color,
          hoist: referenceRole?.hoist,
          icon: referenceRole?.icon,
          mentionable: true,
          permissions: referenceRole?.permissions,
          reason: Constants.GAME_MANAGER_TITLE,
        });
      } catch {}
    }

    const updateData: GuildGameData = {
      status: GameStatus.Approved,
      moderatorId: interaction.user.id,
    };
    if (role) updateData.roleId = role.id;

    guildGameData = await db.guildGameData(guild.id, applicationId, updateData);

    const embed = gm.screeningOperator.makeScreeningEmbed(gameData, guildGameData);
    await interaction.update({ embeds: [embed], components: GameScreeningGuildComponent.data() });
  }

  async deny(interaction: MessageComponentInteraction<CacheType>, applicationId: string) {
    const db = DatabaseFacade.instance();
    const gm = GameManager.instance();

    const guild = interaction.guild;
    if (!guild) return;

    const config = await db.gameConfig(guild.id);
    if (!config?.enabled) return;

    const gameData = await db.gameData(applicationId);
    if (!gameData) return;

    let guildGameData = await db.guildGameData(guild.id, applicationId);
    if (!guildGameData) return;

    let roleDeleted = false;
    if (guildGameData.roleId && guild.roles.cache.get(guildGameData.roleId)) {
      try {
        await guild.roles.delete(guildGameData.roleId, Constants.GAME_MANAGER_TITLE);
        roleDeleted = true;
      } catch {}
    }

    guildGameData = await db.guildGameData(guild.id, applicationId, {
      status: GameStatus.Denied,
      roleId: roleDeleted ? undefined : guildGameData.roleId,
      moderatorId: interaction.user.id,
    });

    const embed = gm.screeningOperator.makeScreeningEmbed(gameData, guildGameData);
    await interaction.update({ embeds: [embed], components: GameScreeningGuildComponent.data() });
  }

  async refresh(interaction: MessageComponentInteraction<CacheType>, applicationId: string) {
    const db = DatabaseFacade.instance();
    const gm = GameManager.instance();

    const guild = interaction.guild;
    if (!guild) return;

    const config = await db.gameConfig(guild.id);
    if (!config?.enabled) return;

    const gameData = await db.gameData(applicationId);
    if (!gameData) return;

    const guildGameData = await db.guildGameData(guild.id, applicationId);
    if (!guildGameData) return;

    const embed = gm.screeningOperator.makeScreeningEmbed(gameData, guildGameData);
    await interaction.update({ embeds: [embed], components: GameScreeningGuildComponent.data() });
  }
}
