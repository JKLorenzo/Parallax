import {
  ApplicationCommandOptionData,
  ChatInputApplicationCommandData,
  CommandInteraction,
  Guild,
} from 'discord.js';
import _ from 'lodash';
import GlobalCommand from './globalcommand.js';

export default abstract class BaseCommand {
  private _data: ChatInputApplicationCommandData;
  private _type: 'guild' | 'global';

  constructor(data: ChatInputApplicationCommandData, type: 'guild' | 'global') {
    this._data = {
      name: data.name,
      description: data.description,
      options: data.options ?? [],
      defaultPermission: data.defaultPermission,
    };
    this._type = type;
  }

  abstract init(guild?: Guild): Promise<void>;

  abstract exec(interaction: CommandInteraction): Promise<unknown>;

  get data(): ChatInputApplicationCommandData {
    return {
      name: this._data.name,
      description: this._data.description,
      type: 'CHAT_INPUT',
      options: this._transformOptions(),
      defaultPermission: this._data.defaultPermission,
    };
  }

  patch(data: ChatInputApplicationCommandData): void {
    this._data = {
      name: data.name,
      description: data.description,
      options: data.options ?? [],
      defaultPermission: data.defaultPermission,
    };
  }

  isGlobal(): this is GlobalCommand {
    return this._type === 'global';
  }

  isUpdated(data: ChatInputApplicationCommandData): boolean {
    const sameDescription = data.description === this.data.description;
    const sameOptions = _.isEqual(data.options, this.data.options);
    const sameDefaultPermissions = data.defaultPermission === this.data.defaultPermission;
    return sameDescription && sameOptions && sameDefaultPermissions;
  }

  private _transformOptions(options = this._data.options): ApplicationCommandOptionData[] {
    if (!options && !Array.isArray(options)) return [];
    return options.map(option => ({
      type: option.type,
      name: option.name,
      description: option.description,
      required:
        option.type === 'SUB_COMMAND' || option.type === 'SUB_COMMAND_GROUP'
          ? option.required
          : option.required ?? false,
      choices:
        option.type === 'STRING' || option.type === 'NUMBER' || option.type === 'INTEGER'
          ? option.choices
          : undefined,
      options:
        (option.type === 'SUB_COMMAND' || option.type === 'SUB_COMMAND_GROUP') && option.options
          ? this._transformOptions(option.options)
          : undefined,
    })) as ApplicationCommandOptionData[];
  }
}
