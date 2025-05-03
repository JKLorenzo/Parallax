import type { Awaitable, MessageComponentInteraction } from 'discord.js';
import Telemetry from '../telemetry/telemetry.js';
import InteractionManager from '../interaction/interaction_manager.js';

export abstract class Component {
  name: string;
  telemetry: Telemetry;

  constructor() {
    this.name = this.constructor.name;
    this.telemetry = new Telemetry(this);
  }

  static makeId(id: string) {
    return [this.name, id].join(InteractionManager.CustomIdSeparator);
  }

  abstract exec(interaction: MessageComponentInteraction, customId: string): Awaitable<unknown>;
}
