import {
  MessageActionRow,
  MessageActionRowComponent,
  MessageActionRowOptions,
  MessageComponentInteraction,
} from 'discord.js';

type ComponentData = {
  name: string;
  options: MessageActionRowOptions[];
};

export default abstract class Component {
  private _name: string;
  private _options: MessageActionRowOptions[];

  constructor(data: ComponentData) {
    this._name = data.name;
    this._options = data.options;
  }

  abstract exec(interaction: MessageComponentInteraction, customId: string): Promise<unknown>;

  get name(): string {
    return this._name;
  }

  get options(): MessageActionRowOptions[] {
    return this._options.map(
      action_row =>
        new MessageActionRow({
          components: action_row.components.map(component => ({
            ...component,
            customId: `${this.name}__${(component as MessageActionRowComponent).customId}`,
          })) as MessageActionRowComponent[],
        }),
    );
  }
}
