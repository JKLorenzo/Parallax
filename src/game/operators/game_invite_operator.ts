import { Colors, EmbedBuilder, type Role } from 'discord.js';
import type { Message } from 'discord.js';
import type { GameData } from '../../database/database_defs.js';
import { Constants } from '../../misc/constants.js';
import Utils from '../../modules/utils.js';
import DatabaseFacade from '../../database/database_facade.js';
import GameInviteComponent from '../components/game_invite_component.js';

export default class GameInviteOperator {
  static makeInviteEmbed(inviterId: string, data: GameData, joinersId?: string[]) {
    const embed = new EmbedBuilder({
      author: { name: Constants.GAME_MANAGER_TITLE },
      title: data.name,
      fields: [
        {
          name: Constants.GAME_EMBED_INVITER_FIELD,
          value: Utils.mentionUserById(inviterId),
          inline: true,
        },
      ],
      footer: { text: `${new Date()}` },
      color: Colors.Yellow,
    });

    if (data.id) {
      embed.addFields({ name: Constants.GAME_EMBED_APPID_FIELD, value: data.id, inline: true });
    }

    if (joinersId?.length) {
      embed.addFields(
        joinersId.map((joiner, i) => ({
          name: `Player ${i + 2}`,
          value: Utils.mentionUserById(joiner),
        })),
      );
    }

    if (data.iconURLs?.length && typeof data.iconIndex === 'number') {
      embed.setThumbnail(data.iconURLs[data.iconIndex]);
    }

    if (data.bannerURLs?.length && typeof data.bannerIndex === 'number') {
      embed.setImage(data.bannerURLs[data.bannerIndex]);
    }

    return embed;
  }

  static async gameInvite(message: Message<boolean>, role: Role) {
    const db = DatabaseFacade.instance();

    const guildGameData = await db.findGuildGameByRole(role.guild.id, role.id);
    if (!guildGameData?.id) return;

    const gameData = await db.gameData(guildGameData.id);
    if (!gameData) return;

    const joinersId = message.mentions.users
      .filter(user => !user.bot)
      .map(user => user.id)
      .filter(Utils.filterUnique);

    const reply = GameInviteComponent.createInteractable(
      message.author.id,
      gameData,
      guildGameData,
      role,
      joinersId,
    );

    const invite = await message.reply(reply);
    setTimeout(async () => {
      try {
        await invite.delete();
      } catch (_) {}
    }, Constants.GAME_INVITE_EXPIRATION_MINS * 60000);
  }
}
