import type Bot from './Bot';

export default abstract class Manager {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }
}
