import {
  MessageComponentInteraction,
  type CacheType,
  ComponentType,
  ButtonStyle,
  type ActionRowData,
  type MessageActionRowComponentData,
  MessageFlags,
  Colors,
} from 'discord.js';
import DatabaseFacade from '../../../global/database/database_facade.js';
import Component from '../component.js';
import Constants from '../../../static/constants.js';
import { type GameData } from '../../../global/database/database_defs.js';
import GameManager from '../../game/game_manager.js';
import Utils from '../../../static/utils.js';

enum Id {
  Join = 'join',
  Leave = 'leave',
  Close = 'close',
}

export default class GameInviteComponent extends Component {
  static data(): ActionRowData<MessageActionRowComponentData>[] {
    return [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            customId: this.makeId(Id.Join),
            label: 'Join',
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
          },
          {
            customId: this.makeId(Id.Leave),
            label: 'Leave',
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
          },
          {
            customId: this.makeId(Id.Close),
            label: 'Mark as Full / Cancel',
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

    const inviterMention = interaction.message.embeds
      .find(embed => embed.author?.name === Constants.GAME_MANAGER_TITLE)
      ?.fields.find(field => field.name === Constants.GAME_EMBED_INVITER_FIELD)?.value;
    if (!inviterMention) return;

    const inviterId = Utils.parseMention(inviterMention);

    switch (customId) {
      case Id.Join:
        await this.join(interaction, inviterId, gameData);
        break;
      case Id.Leave:
        await this.leave(interaction, inviterId, gameData);
        break;
      case Id.Close:
        await this.close(interaction, inviterId, gameData);
        break;
      default:
    }
  }

  async join(
    interaction: MessageComponentInteraction<CacheType>,
    inviter: string,
    gameData: GameData,
  ) {
    if (inviter === interaction.user.id) {
      return interaction.deferUpdate();
    }

    let joiners =
      interaction.message.embeds
        .find(embed => embed.author?.name === Constants.GAME_MANAGER_TITLE)
        ?.fields.filter(field => Utils.hasAny(field.name, 'Player'))
        ?.map(field => Utils.parseMention(field.value)) ?? [];

    const willUpdate = !joiners.some(joiner => joiner === interaction.user.id);
    if (willUpdate) joiners.push(interaction.user.id);

    const embed = GameManager.makeInviteEmbed(inviter, gameData, joiners);
    if (willUpdate) embed.setColor(Colors.Green);
    await interaction.update({ embeds: [embed] });

    if (willUpdate) {
      for (const player in [inviter, ...joiners].filter(player => player != interaction.user.id)) {
        const dmChannel = await interaction.guild?.members.cache.get(player)?.createDM();
        dmChannel?.send(
          `**${interaction.user.displayName}** joined the **${gameData.name}** game invite on **${interaction.guild}**.`,
        );
      }
    }
  }

  async leave(
    interaction: MessageComponentInteraction<CacheType>,
    inviter: string,
    gameData: GameData,
  ) {
    if (inviter === interaction.user.id) {
      return interaction.deferUpdate();
    }

    let joiners =
      interaction.message.embeds
        .find(embed => embed.author?.name === Constants.GAME_MANAGER_TITLE)
        ?.fields.filter(field => Utils.hasAny(field.name, 'Player'))
        ?.map(field => Utils.parseMention(field.value)) ?? [];

    const willUpdate = joiners.some(joiner => joiner === interaction.user.id);
    if (willUpdate) joiners = joiners.filter(joiner => joiner !== interaction.user.id);

    const embed = GameManager.makeInviteEmbed(inviter, gameData, joiners);
    if (willUpdate) embed.setColor(Colors.Fuchsia);
    await interaction.update({ embeds: [embed] });

    if (willUpdate) {
      for (const player in [inviter, ...joiners]) {
        const dmChannel = await interaction.guild?.members.cache.get(player)?.createDM();
        dmChannel?.send(
          `**${interaction.user.displayName}** left the **${gameData.name}** game invite on **${interaction.guild}**.`,
        );
      }
    }
  }

  async close(
    interaction: MessageComponentInteraction<CacheType>,
    inviter: string,
    gameData: GameData,
  ) {
    if (Utils.parseMention(inviter) !== interaction.user.id) {
      return interaction.reply({
        content: 'Only the inviter can close this invitation.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const joiners =
      interaction.message.embeds
        .find(embed => embed.author?.name === Constants.GAME_MANAGER_TITLE)
        ?.fields.filter(field => Utils.hasAny(field.name, 'Player'))
        ?.map(field => Utils.parseMention(field.value)) ?? [];

    const embed = GameManager.makeInviteEmbed(inviter, gameData, joiners);
    embed.setColor(Colors.Blurple);
    await interaction.update({ embeds: [embed], components: [] });
  }
}
