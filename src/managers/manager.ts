import Telemetry from '../global/telemetry/telemetry.js';
import type Bot from '../modules/bot.js';

export default abstract class Manager extends Telemetry {
  bot: Bot;

  constructor(bot: Bot) {
    super();

    this.bot = bot;
  }
}
