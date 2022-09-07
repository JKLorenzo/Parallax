import type Bot from '../modules/Bot.js';

declare module 'discord.js' {
  interface Client {
    bot: Bot;
  }
}
