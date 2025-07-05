import { Colors, EmbedBuilder, type Role } from 'discord.js';
import type { SendableChannels } from 'discord.js';
import type { GameData, GameInviteData } from '../../database/database_defs.js';
import { Constants } from '../../misc/constants.js';
import Utils from '../../misc/utils.js';
import DatabaseFacade from '../../database/database_facade.js';
import GameInviteComponent from '../components/game_invite_component.js';
import { client } from '../../main.js';
import GameManager from '../game_manager.js';

export default class GameInviteOperator {
  async createGameInvite(
    inviterId: string,
    channel: SendableChannels,
    role: Role,
    joinerIds: string[],
    maxSlot?: number,
    time?: number,
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

    if (maxSlot && maxSlot > GameManager.rsvpMax) maxSlot = GameManager.rsvpMax;

    const partialData: Omit<GameInviteData, 'messageId'> = {
      id: Utils.makeId(17, '0123456789'),
      name: gameData.name,
      appId: gameData.id,
      guildId: role.guild.id,
      roleId: role.id,
      inviterId: inviterId,
      joinersId: joinerIds.filter(Utils.filterUnique),
      maxSlot: maxSlot,
      time: time,
      inviteDate: new Date(),
    };

    const interactable = GameInviteComponent.createInteractable(partialData);
    const message = await channel.send(interactable);

    const data = { messageId: message.id, ...partialData };
    await db.gameInviteData(data.id, data);

    const expireAtMins = data.time ?? Constants.GAME_INVITE_EXPIRATION_MINS;
    setTimeout(async () => {
      try {
        await message.delete();
        if (data.time) await this.closeGameInvite(data, gameData);
      } catch (_) {}
    }, expireAtMins * 60000);

    return message;
  }

  async closeGameInvite(data: GameInviteData, gameData: GameData) {
    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) return;

    const players = [data.inviterId, ...data.joinersId];

    const inviteClosedEmbed = new EmbedBuilder({
      author: { iconURL: guild.iconURL() ?? undefined, name: guild.name },
      title: data.name,
      description: data.id,
      fields: [
        ...players.map((players, i) => ({
          name: `Player ${i + 1}`,
          value: Utils.mentionUserById(players),
          inline: true,
        })),
      ],
      color: Colors.Blurple,
    });

    if (gameData.iconURLs?.length && typeof gameData.iconIndex === 'number') {
      inviteClosedEmbed.setThumbnail(gameData.iconURLs[gameData.iconIndex]);
    }

    if (gameData.bannerURLs?.length && typeof gameData.bannerIndex === 'number') {
      inviteClosedEmbed.setImage(gameData.bannerURLs[gameData.bannerIndex]);
    }

    for (const player of players) {
      try {
        const dmChannel = await guild?.members.cache.get(player)?.createDM();
        dmChannel?.send({
          content: `The **${data.name}** party is now closed. Good luck!`,
          embeds: [inviteClosedEmbed],
        });
      } catch (_) {}
    }
  }
}
