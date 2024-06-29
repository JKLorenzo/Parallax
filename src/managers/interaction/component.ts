import type {
  ActionRowData,
  Awaitable,
  MessageActionRowComponentData,
  MessageComponentInteraction,
} from 'discord.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import type Bot from '../../modules/bot.js';

type ComponentOptions = {
  name: string;
  data: ActionRowData<MessageActionRowComponentData>[];
};

export default abstract class Component {
  bot: Bot;
  name: string;
  data: ActionRowData<MessageActionRowComponentData>[];
  telemetry: Telemetry;

  constructor(bot: Bot, options: ComponentOptions) {
    this.bot = bot;
    this.name = options.name;
    this.data = options.data;
    this.telemetry = new Telemetry(this, { parent: bot.telemetry });
  }

  // eslint-disable-next-line no-unused-vars
  abstract exec(interaction: MessageComponentInteraction, customId: string): Awaitable<unknown>;
}
