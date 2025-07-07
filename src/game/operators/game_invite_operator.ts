import { Colors, EmbedBuilder, type Role } from 'discord.js';
import type { SendableChannels } from 'discord.js';
import type { GameInviteData } from '../../database/database_defs.js';
import { Constants } from '../../misc/constants.js';
import Utils from '../../misc/utils.js';
import DatabaseFacade from '../../database/database_facade.js';
import GameInviteComponent from '../components/game_invite_component.js';
import { client } from '../../main.js';
import GameManager from '../game_manager.js';
import Queuer from '../../misc/queuer.js';

export default class GameInviteOperator {
  private messageQueue: Queuer;

  constructor() {
    this.messageQueue = new Queuer();
  }

  async init() {
    const db = DatabaseFacade.instance();
    await db.loadGameInviteData();

    client.on('messageCreate', async message => {
      const db = DatabaseFacade.instance();

      if (message.author.bot) return;
      if (!message.inGuild()) return;

      const config = await db.gameConfig(message.guildId);
      if (!config?.enabled) return;

      for (const role of message.mentions.roles.values()) {
        this.messageQueue.queue(() =>
          this.createGameInvite(
            message.author.id,
            message.channel,
            role,
            message.mentions.users.filter(u => !u.bot).map(u => u.id),
          ),
        );
      }
    });
  }

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
      channelId: channel.id,
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
      await this.closeGameInvite(data);
    }, expireAtMins * 60000);

    return message;
  }

  async closeGameInvite(data: GameInviteData) {
    const db = DatabaseFacade.instance();

    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(data.channelId);
    if (channel?.isTextBased()) {
      const message = await channel.messages.fetch(data.messageId);

      try {
        if (message?.deletable) await message.delete();
      } catch (_) {}
    }

    const gameData = await db.gameData(data.appId);
    if (!gameData) return;

    const players = [data.inviterId, ...data.joinersId];
    const isFull = data.maxSlot && players.length >= data.maxSlot;
    const isTime =
      data.time && Utils.addToDate(data.inviteDate, data.time, 'minutes') >= new Date();

    if (isFull || isTime) {
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
            content: `The **${data.name}** party is now ${isFull ? 'full' : 'closed'}. Good luck!`,
            embeds: [inviteClosedEmbed],
          });
        } catch (_) {}
      }
    }

    await db.deleteGameInvite(data.id);
  }
}
