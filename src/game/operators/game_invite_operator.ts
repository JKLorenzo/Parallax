import { Colors, EmbedBuilder, type Role } from 'discord.js';
import type { SendableChannels } from 'discord.js';
import type { GameData, GameInviteData } from '../../database/database_defs.js';
import { Constants } from '../../misc/constants.js';
import Utils from '../../misc/utils.js';
import DatabaseFacade from '../../database/database_facade.js';
import GameInviteComponent from '../components/game_invite_component.js';
import { client } from '../../main.js';

export default class GameInviteOperator {
  makeInviteEmbed(inviterId: string, data: GameData, joinersId?: string[]) {
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

  async createGameInvite(
    inviterId: string,
    channel: SendableChannels,
    role: Role,
    joinerIds: string[],
    maxSlot?: number,
  ) {
    const db = DatabaseFacade.instance();

    const guildGameData = await db.findGuildGameByRole(role.guild.id, role.id);
    if (!guildGameData?.id) return;

    const gameData = await db.gameData(guildGameData.id);
    if (!gameData?.id || !gameData?.name) return;

    joinerIds = joinerIds.filter(id => {
      const user = client.users.cache.get(id);
      if (!user || user.bot) return false;
      if (user.id === inviterId) return false;

      return true;
    });

    const data: Omit<GameInviteData, 'messageId'> = {
      id: Utils.makeId(17, '0123456789'),
      name: gameData.name,
      appId: gameData.id,
      guildId: role.guild.id,
      roleId: role.id,
      inviterId: inviterId,
      inviteDate: new Date(),
      joinersId: joinerIds.filter(Utils.filterUnique),
      maxSlot: maxSlot,
    };

    const interactable = GameInviteComponent.createInteractable(data);
    const message = await channel.send(interactable);

    await db.gameInviteData(data.id, { messageId: message.id, ...data });

    setTimeout(async () => {
      try {
        await message.delete();
      } catch (_) {}
    }, Constants.GAME_INVITE_EXPIRATION_MINS * 60000);

    return message;
  }
}
