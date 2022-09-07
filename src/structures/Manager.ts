import type Bot from '../modules/Bot.js';

export default abstract class Manager {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }
}
