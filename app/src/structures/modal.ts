import type { Awaitable, ModalComponentData, ModalSubmitInteraction } from 'discord.js';
import type Bot from '../modules/bot.js';

export default abstract class Modal {
  bot: Bot;
  data: ModalComponentData;

  constructor(bot: Bot, data: ModalComponentData) {
    this.bot = bot;
    this.data = data;
  }

  // eslint-disable-next-line no-unused-vars
  abstract exec(interaction: ModalSubmitInteraction): Awaitable<unknown>;
}
