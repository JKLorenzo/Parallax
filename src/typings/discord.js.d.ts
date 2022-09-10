import type Bot from '../modules/bot.js';

declare module 'discord.js' {
  interface Client {
    bot: Bot;
  }
}
