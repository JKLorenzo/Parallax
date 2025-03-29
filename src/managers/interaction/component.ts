import type {
  ActionRowData,
  Awaitable,
  MessageActionRowComponentData,
  MessageComponentInteraction,
} from 'discord.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import type Bot from '../../modules/bot.js';
import InteractionManager from './interaction_manager.js';

export default abstract class Component {
  bot: Bot;
  name: string;
  telemetry: Telemetry;

  constructor(bot: Bot) {
    this.bot = bot;
    this.name = this.constructor.name;
    this.telemetry = new Telemetry(this, { parent: bot.telemetry });
  }

  static makeId(id: string) {
    return [this.name, id].join(InteractionManager.CustomIdSeparator);
  }

  static data(): ActionRowData<MessageActionRowComponentData>[] {
    throw new Error('Not implemented!');
  }

  abstract exec(interaction: MessageComponentInteraction, customId: string): Awaitable<unknown>;
}
