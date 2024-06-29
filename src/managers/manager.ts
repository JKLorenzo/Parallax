import Telemetry from '../global/telemetry/telemetry.js';
import type { TelemetryOptions } from '../global/telemetry/telemetry_defs.js';
import type Bot from '../modules/bot.js';

export default abstract class Manager {
  bot: Bot;
  telemetry: Telemetry;

  constructor(bot: Bot, telemetryOptions?: Omit<TelemetryOptions, 'parent'>) {
    this.bot = bot;
    this.telemetry = new Telemetry(this.constructor.name, {
      ...telemetryOptions,
      parent: bot.telemetry,
    });
  }
}
