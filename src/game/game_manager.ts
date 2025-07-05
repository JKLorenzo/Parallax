import {
  Activity,
  ActivityType,
  Colors,
  EmbedBuilder,
  Guild,
  GuildMember,
} from 'discord.js';
import Queuer from '../misc/queuer.js';
import { Constants } from '../misc/constants.js';
import Utils from '../misc/utils.js';
import GameScreeningOperator from './operators/game_screening_operator.js';
import GameInviteOperator from './operators/game_invite_operator.js';
import Manager from '../modules/manager.js';
import DatabaseFacade from '../database/database_facade.js';
import {
  GameStatus,
  type GameData,
  type GuildGameData,
} from '../database/database_defs.js';
import { client } from '../main.js';

export default class GameManager extends Manager {
  private static _instance: GameManager;

  private screeningQueue: Queuer;
  private roleQueue: Queuer;
  private timekeepingQueue: Queuer;
  private messageQueue: Queuer;

  inviteOperator: GameInviteOperator;
  screeningOperator: GameScreeningOperator;

  private constructor() {
    super();

    this.screeningQueue = new Queuer();
    this.roleQueue = new Queuer();
    this.timekeepingQueue = new Queuer();
    this.messageQueue = new Queuer();

    this.inviteOperator = new GameInviteOperator();
    this.screeningOperator = new GameScreeningOperator();
  }

  static instance() {
    if (!this._instance) {
      this._instance = new GameManager();
    }

    return this._instance;
  }

  static get rsvpMin() {
    return 2;
  }

  static get rsvpMax() {
    return 10;
  }

  static get rsvpArray() {
    const rsvp: number[] = [];
    for (let i = this.rsvpMin; i <= this.rsvpMax; i++) rsvp.push(i);
    return rsvp;
  }

  async init() {
    const db = DatabaseFacade.instance();
    await db.loadGameData();

    client.on('presenceUpdate', async (oldPresence, newPresence) => {
      const db = DatabaseFacade.instance();

      const member = newPresence.member;
      if (!member) return;

      const games = newPresence.activities.filter(
        activity => activity.type === ActivityType.Playing,
      );
      if (games.length === 0) return;

      const config = await db.gameConfig(member.guild.id);
      if (!config?.enabled) return;

      for (const game of games) {
        this.screeningQueue.queue(() => this.screeningOperator.screenGame(game));
        this.screeningQueue.queue(() => this.screeningOperator.screenGuildGame(game, member.guild));
        this.roleQueue.queue(() => this.addGameRole(game, member));
        this.timekeepingQueue.queue(() => this.updateGameLastPlayed(game, member.guild));
      }
    });

    client.on('messageCreate', async message => {
      const db = DatabaseFacade.instance();

      if (message.author.bot) return;
      if (!message.inGuild()) return;

      const config = await db.gameConfig(message.guildId);
      if (!config?.enabled) return;

      for (const role of message.mentions.roles.values()) {
        this.messageQueue.queue(() =>
          this.inviteOperator.createGameInvite(
            message.author.id,
            message.channel,
            role,
            message.mentions.users.filter(u => !u.bot).map(u => u.id),
          ),
        );
      }
    });
  }

  static makeScreeningEmbed(data: GameData, guildData?: GuildGameData) {
    const embed = new EmbedBuilder({
      author: { name: Constants.GAME_MANAGER_TITLE },
      title: data.name,
    });

    switch (guildData ? guildData.status : data.status) {
      case GameStatus.Pending:
        embed
          .addFields({ name: Constants.GAME_EMBED_STATUS_FIELD, value: 'Pending', inline: true })
          .setColor(Colors.Blurple);
        break;
      case GameStatus.Approved:
        embed
          .addFields({ name: Constants.GAME_EMBED_STATUS_FIELD, value: 'Approved', inline: true })
          .setColor(Colors.Green);
        break;
      case GameStatus.Denied:
        embed
          .addFields({ name: Constants.GAME_EMBED_STATUS_FIELD, value: 'Denied', inline: true })
          .setColor(Colors.Fuchsia);
        break;
      default:
        embed
          .addFields({
            name: Constants.GAME_EMBED_STATUS_FIELD,
            value: `Unknown (${data.status})`,
            inline: true,
          })
          .setColor(Colors.Red);
        break;
    }

    if (data.id) {
      embed.addFields({ name: Constants.GAME_EMBED_APPID_FIELD, value: data.id, inline: true });
    }

    const moderatorId = guildData ? guildData.moderatorId : data.moderatorId;
    if (moderatorId) {
      embed.addFields({
        name: Constants.GAME_EMBED_MOD_FIELD,
        value: Utils.mentionUserById(moderatorId),
      });
    }

    if (data.iconURLs?.length && typeof data.iconIndex === 'number') {
      embed.setThumbnail(data.iconURLs[data.iconIndex]);

      if (!guildData) {
        embed.addFields({
          name: Constants.GAME_EMBED_ICON_FIELD,
          value: `${data.iconIndex + 1} / ${data.iconURLs.length}`,
          inline: true,
        });
      }
    }

    if (data.bannerURLs?.length && typeof data.bannerIndex === 'number') {
      embed.setImage(data.bannerURLs[data.bannerIndex]);

      if (!guildData) {
        embed.addFields({
          name: Constants.GAME_EMBED_BANNER_FIELD,
          value: `${data.bannerIndex + 1} / ${data.bannerURLs.length}`,
          inline: true,
        });
      }
    }

    if (guildData?.roleId) {
      embed.addFields({
        name: Constants.GAME_EMBED_ROLE_FIELD,
        value: Utils.mentionRoleById(guildData.roleId),
        inline: true,
      });
    }

    if (guildData?.lastPlayed) {
      embed.addFields({
        name: Constants.GAME_EMBED_LASTPLAYED_FIELD,
        value: guildData.lastPlayed.toString(),
      });
    }

    return embed;
  }

  private async addGameRole(game: Activity, member: GuildMember) {
    const db = DatabaseFacade.instance();

    if (!game.applicationId) return;

    const gameData = await db.gameData(game.applicationId);
    if (gameData?.status !== GameStatus.Approved) return;

    const guildGameData = await db.guildGameData(member.guild.id, game.applicationId);
    if (guildGameData?.status !== GameStatus.Approved) return;

    if (!guildGameData.roleId) return;
    if (member.roles.cache.has(guildGameData.roleId)) return;

    const role = member.guild.roles.cache.get(guildGameData.roleId);
    if (!role) return;

    await member.roles.add(role, Constants.GAME_MANAGER_TITLE);
  }

  private async updateGameLastPlayed(game: Activity, guild: Guild) {
    const db = DatabaseFacade.instance();

    if (!game.applicationId) return;

    const gameData = await db.gameData(game.applicationId);
    if (gameData?.status !== GameStatus.Approved) return;

    const guildGameData = await db.guildGameData(guild.id, game.applicationId);
    if (guildGameData?.status !== GameStatus.Approved) return;

    let updateNeeded = true;
    if (guildGameData.lastPlayed) {
      const difference = Utils.compareDate(guildGameData.lastPlayed);
      if (difference.days < 1) updateNeeded = false;
    }
    if (!updateNeeded) return;

    await db.guildGameData(guild.id, game.applicationId, {
      lastPlayed: new Date(),
    });
  }
}
