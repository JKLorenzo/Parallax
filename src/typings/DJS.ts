/* eslint-disable no-unused-vars */

import type Bot from '../structures/Bot';

declare module 'discord.js' {
  interface Client {
    bot: Bot;
  }
}
