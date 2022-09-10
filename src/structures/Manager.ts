import type Bot from '../modules/bot.js';

export default abstract class Manager {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }
}
