import type { Awaitable, MessageComponentInteraction } from 'discord.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import type Bot from '../../modules/bot.js';
import InteractionManager from './interaction_manager.js';

export abstract class Component {
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

  abstract exec(interaction: MessageComponentInteraction, customId: string): Awaitable<unknown>;
}

export abstract class ComponentV2 {
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

  abstract exec(interaction: MessageComponentInteraction, customId: string): Awaitable<unknown>;
}
