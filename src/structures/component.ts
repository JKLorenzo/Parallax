import type {
  ActionRowData,
  MessageActionRowComponentData,
  MessageComponentInteraction,
} from 'discord.js';

type ComponentOptions = {
  name: string;
  data: ActionRowData<MessageActionRowComponentData>[];
};

export default abstract class Component {
  name: string;
  data: ActionRowData<MessageActionRowComponentData>[];

  constructor(options: ComponentOptions) {
    this.name = options.name;
    this.data = options.data;
  }

  // eslint-disable-next-line no-unused-vars
  abstract exec(interaction: MessageComponentInteraction, customId: string): unknown;
}
