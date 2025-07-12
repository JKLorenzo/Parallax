import { ActivityType, type ActivityOptions } from 'discord.js';
import type { Executable } from '../database/database_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import { client } from '../main.js';
import Manager from '../modules/manager.js';
import Telemetry from '../telemetry/telemetry.js';
import PalworldServerOperator from './operators/palworld_server_operator.js';

export default class ServerManager extends Manager {
  private static _instance: ServerManager;
  private _executables: Executable[];

  private activities: string[];
  private activityInterval?: NodeJS.Timeout;

  private _palworld?: PalworldServerOperator;

  constructor() {
    super();

    this._executables = [];
    this.activities = [];
  }

  static instance() {
    if (!this._instance) {
      this._instance = new ServerManager();
    }

    return this._instance;
  }

  get executables() {
    return this._executables;
  }

  get palworld() {
    if (!this._palworld) this._palworld = new PalworldServerOperator(this);
    return this._palworld;
  }

  async init() {
    const telemetry = new Telemetry(this.init, { parent: this.telemetry });

    await this.updateExecutables();

    telemetry.end();
  }

  async updateExecutables() {
    const telemetry = new Telemetry(this.updateExecutables, { parent: this.telemetry });
    const db = DatabaseFacade.instance();

    this._executables = await db.fetchExecutables();

    telemetry.end();

    return this.executables;
  }

  async addActivity(executable: Executable) {
    if (this.activities.some(a => a === executable.name)) return;

    this.activities.push(executable.name);
    await this.updateActivities();
  }

  async removeActivity(executable: Executable) {
    if (!this.activities.some(a => a === executable.name)) return;

    this.activities = this.activities.filter(a => a === executable.name);
    await this.updateActivities();
  }

  private async updateActivities() {
    const telemetry = new Telemetry(this.updateActivities, { parent: this.telemetry });

    await client.user?.setPresence({
      activities: this.activities.map(name => {
        const activity: ActivityOptions = {
          name: name,
          type: ActivityType.Playing,
        };
        return activity;
      }),
    });

    if (this.activities.length > 0) {
      this.activityInterval ??= setInterval(() => this.updateActivities(), 1000 * 60 * 30);
    } else if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }

    telemetry.end();
  }
}
