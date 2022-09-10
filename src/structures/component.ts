import type {
  ActionRowComponentData,
  ActionRowData,
  Awaitable,
  MessageComponentInteraction,
} from 'discord.js';
import type Bot from '../modules/bot.js';

type ComponentOptions = {
  name: string;
  data: ActionRowData<ActionRowComponentData>[];
};

export default abstract class Component {
  bot: Bot;
  name: string;
  data: ActionRowData<ActionRowComponentData>[];

  constructor(bot: Bot, options: ComponentOptions) {
    this.bot = bot;
    this.name = options.name;
    this.data = options.data;
  }

  // eslint-disable-next-line no-unused-vars
  abstract exec(interaction: MessageComponentInteraction, customId: string): Awaitable<unknown>;
}
