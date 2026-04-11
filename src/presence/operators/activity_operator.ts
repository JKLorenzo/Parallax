import type { ActivityOptions } from 'discord.js';
import { client } from '../../main.js';
import Telemetry from '../../telemetry/telemetry.js';
import type PresenceManager from '../presence_manager.js';

export default class ActivityOperator {
  private telemetry: Telemetry;
  private activities: ActivityOptions[] = [];
  private activityInterval?: NodeJS.Timeout;

  constructor(manager: PresenceManager) {
    this.telemetry = new Telemetry(this.constructor.name, {
      parent: manager.telemetry,
    });
  }

  async init() {
    const telemetry = this.telemetry.start(this.init);

    await this.updateActivities();

    telemetry.end();
  }

  async addActivity(activity: ActivityOptions) {
    const telemetry = this.telemetry.start(this.addActivity);

    if (this.activities.some(a => a.name === activity.name)) return telemetry.end();
    this.activities.push(activity);
    await this.updateActivities();

    telemetry.end();
  }

  async removeActivity(name: string) {
    const telemetry = this.telemetry.start(this.removeActivity);

    if (!this.activities.some(a => a.name === name)) return telemetry.end();
    this.activities = this.activities.filter(activity => activity.name !== name);
    await this.updateActivities();

    telemetry.end();
  }

  private async updateActivities() {
    const telemetry = this.telemetry.start(this.updateActivities);

    await client.user?.setPresence({ activities: this.activities });

    if (this.activities.length > 0) {
      this.activityInterval ??= setInterval(() => this.updateActivities(), 1000 * 60 * 30);
    } else if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }

    telemetry.end();
  }
}
