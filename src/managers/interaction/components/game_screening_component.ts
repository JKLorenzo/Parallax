import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  ButtonStyle,
  type ActionRowData,
  type MessageActionRowComponentData,
} from 'discord.js';
import DatabaseFacade from '../../../global/database/database_facade.js';
import Component from '../component.js';
import Constants from '../../../static/constants.js';
import { GameStatus, type GameData } from '../../../global/database/database_defs.js';
import GameManager from '../../game/game_manager.js';

enum Id {
  Approve = 'approve',
  Deny = 'deny',
  CycleIcon = 'cyleicon',
  CycleBanner = 'cyclebanner',
}

export default class GameScreeningComponent extends Component {
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
            customId: this.makeId(Id.Deny),
            label: 'Deny',
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
          },
          {
            customId: this.makeId(Id.CycleIcon),
            label: 'Cycle Icon',
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
          },
          {
            customId: this.makeId(Id.CycleBanner),
            label: 'Cycle Banner',
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
          },
        ],
      },
    ];
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: Id) {
    const db = DatabaseFacade.instance();

    const applicationId = interaction.message.embeds
      .find(embed => embed.author?.name === Constants.GAME_MANAGER_TITLE)
      ?.fields.find(field => field.name === Constants.GAME_EMBED_APPID_FIELD)?.value;
    if (!applicationId) return;

    const gameData = await db.gameData(applicationId);
    if (!gameData) return;

    switch (customId) {
      case Id.Approve:
        await this.approve(interaction, applicationId);
        break;
      case Id.Deny:
        await this.deny(interaction, applicationId);
        break;
      case Id.CycleIcon:
        await this.cycleIcon(interaction, applicationId, gameData);
        break;
      case Id.CycleBanner:
        await this.cycleBanner(interaction, applicationId, gameData);
        break;
      default:
    }
  }

  async approve(interaction: MessageComponentInteraction<CacheType>, applicationId: string) {
    const db = DatabaseFacade.instance();

    const gameData = await db.gameData(applicationId, {
      status: GameStatus.Approved,
      moderatorId: interaction.user.id,
    });
    if (!gameData) return;

    const embed = GameManager.makeScreeningEmbed(gameData);
    await interaction.update({ embeds: [embed], components: GameScreeningComponent.data() });
  }

  async deny(interaction: MessageComponentInteraction<CacheType>, applicationId: string) {
    const db = DatabaseFacade.instance();

    const gameData = await db.gameData(applicationId, {
      status: GameStatus.Denied,
      moderatorId: interaction.user.id,
    });
    if (!gameData) return;

    const embed = GameManager.makeScreeningEmbed(gameData);
    await interaction.update({ embeds: [embed], components: GameScreeningComponent.data() });
  }

  async cycleIcon(
    interaction: MessageComponentInteraction<CacheType>,
    applicationId: string,
    gameData: GameData,
  ) {
    const db = DatabaseFacade.instance();

    if (typeof gameData.iconIndex === 'undefined') return;
    if (typeof gameData.iconURLs === 'undefined') return;

    if (++gameData.iconIndex >= gameData.iconURLs.length) {
      gameData.iconIndex = 0;
    }

    await db.gameData(applicationId, {
      iconIndex: gameData.iconIndex,
      moderatorId: interaction.user.id,
    });

    const embed = GameManager.makeScreeningEmbed(gameData);
    await interaction.update({ embeds: [embed], components: GameScreeningComponent.data() });
  }

  async cycleBanner(
    interaction: MessageComponentInteraction<CacheType>,
    applicationId: string,
    gameData: GameData,
  ) {
    const db = DatabaseFacade.instance();

    if (typeof gameData.bannerIndex === 'undefined') return;
    if (typeof gameData.bannerURLs === 'undefined') return;

    if (++gameData.bannerIndex >= gameData.bannerURLs.length) {
      gameData.bannerIndex = 0;
    }

    await db.gameData(applicationId, {
      bannerIndex: gameData.bannerIndex,
      moderatorId: interaction.user.id,
    });

    const embed = GameManager.makeScreeningEmbed(gameData);
    await interaction.update({ embeds: [embed], components: GameScreeningComponent.data() });
  }
}
