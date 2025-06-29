import type { Awaitable, MessageComponentInteraction } from 'discord.js';
import Telemetry from '../telemetry/telemetry.js';
import InteractionManager from '../interaction/interaction_manager.js';
import InteractionComponentOperator from '../interaction/operators/interaction_component_operator.js';

export abstract class Component {
  name: string;
  telemetry: Telemetry;

  constructor() {
    this.name = this.constructor.name;
    this.telemetry = new Telemetry(this);
  }

  static makeId(id: string) {
    return [this.name, id].join(InteractionComponentOperator.Separator);
  }

  abstract exec(interaction: MessageComponentInteraction, customId: string): Awaitable<unknown>;
}
