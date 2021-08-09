import {
  ApplicationCommandData,
  ApplicationCommandOptionData,
  CommandInteraction,
} from 'discord.js';
import _ from 'lodash';
import GlobalCommand from './globalcommand.js';

export default abstract class BaseCommand {
  private _data: ApplicationCommandData;
  private _type: 'guild' | 'global';

  constructor(data: ApplicationCommandData, type: 'guild' | 'global') {
    this._data = {
      description: data.description,
      name: data.name,
      defaultPermission: data.defaultPermission,
      options: data.options ?? [],
    };
    this._type = type;
  }

  abstract init(): Promise<void>;

  abstract exec(interaction: CommandInteraction): Promise<unknown>;

  get data(): ApplicationCommandData {
    return {
      name: this._data.name,
      description: this._data.description,
      options: this._transformOptions(),
      defaultPermission: this._data.defaultPermission,
    };
  }

  isGlobal(): this is GlobalCommand {
    return this._type === 'global';
  }

  isUpdated(data: ApplicationCommandData): boolean {
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
      choices: option.choices,
      options: option.options ? this._transformOptions(option.options) : undefined,
    }));
  }
}
