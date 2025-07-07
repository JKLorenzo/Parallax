import { Activity, ActivityType, Guild, GuildMember } from 'discord.js';
import Queuer from '../misc/queuer.js';
import { Constants } from '../misc/constants.js';
import Utils from '../misc/utils.js';
import GameScreeningOperator from './operators/game_screening_operator.js';
import GameInviteOperator from './operators/game_invite_operator.js';
import Manager from '../modules/manager.js';
import DatabaseFacade from '../database/database_facade.js';
import { GameStatus } from '../database/database_defs.js';
import { client } from '../main.js';

export default class GameManager extends Manager {
  private static _instance: GameManager;

  private roleQueue: Queuer;
  private timekeepingQueue: Queuer;

  inviteOperator: GameInviteOperator;
  screeningOperator: GameScreeningOperator;

  private constructor() {
    super();

    this.roleQueue = new Queuer();
    this.timekeepingQueue = new Queuer();

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

    await this.screeningOperator.init();
    await this.inviteOperator.init();

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
        this.roleQueue.queue(() => this.addGameRole(game, member));
        this.timekeepingQueue.queue(() => this.updateGameLastPlayed(game, member.guild));
      }
    });
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
