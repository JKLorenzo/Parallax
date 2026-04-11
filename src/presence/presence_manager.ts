import type { ActivityOptions } from 'discord.js';
import Manager from '../modules/manager.js';
import ActivityOperator from './operators/activity_operator.js';

export default class PresenceManager extends Manager {
  private static _instance: PresenceManager;
  private activity_operator: ActivityOperator;

  private constructor() {
    super();

    this.activity_operator = new ActivityOperator(this);
  }

  static instance(): PresenceManager {
    if (!this._instance) {
      this._instance = new PresenceManager();
    }
    return this._instance;
  }

  async init() {
    const telemetry = this.telemetry.start(this.init);

    await this.activity_operator.init();

    telemetry.end();
  }

  addActivity = (activity: ActivityOptions) => this.activity_operator.addActivity(activity);
  removeActivity = (name: string) => this.activity_operator.removeActivity(name);
}
