import type { Awaitable, ModalComponentData, ModalSubmitInteraction } from 'discord.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import type Bot from '../../modules/bot.js';

export default abstract class Modal {
  bot: Bot;
  data: ModalComponentData;
  telemetry: Telemetry;

  constructor(bot: Bot, data: ModalComponentData) {
    this.bot = bot;
    this.data = data;
    this.telemetry = new Telemetry(this, { parent: bot.telemetry });
  }

  // eslint-disable-next-line no-unused-vars
  abstract exec(interaction: ModalSubmitInteraction): Awaitable<unknown>;
}
