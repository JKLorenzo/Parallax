import {
  ApplicationCommandData,
  ApplicationCommandPermissionData,
  CommandInteraction,
} from 'discord.js';
import { GuildCommandOptions } from '../utils/types';

type CommandOptions = GuildCommandOptions & {
  type: 'guild' | 'global';
};

export default abstract class BaseCommand {
  private _data: ApplicationCommandData;
  private _options: CommandOptions;

  constructor(data: ApplicationCommandData, options: CommandOptions) {
    this._data = {
      description: data.description,
      name: data.name,
      defaultPermission: data.defaultPermission,
      options: data.options ?? [],
    };
    this._options = options;
  }

  abstract init(): Promise<void>;

  abstract exec(interaction: CommandInteraction): Promise<void>;

  get data(): ApplicationCommandData {
    return this._data;
  }

  get options(): CommandOptions {
    return this._options;
  }

  get permissions(): ApplicationCommandPermissionData[] | undefined {
    const permissions = [] as ApplicationCommandPermissionData[];

    if (this._options.permissions) {
      if (this._options.permissions.roles) {
        if (this._options.permissions.roles.allow) {
          this._options.permissions.roles.allow.forEach(id =>
            permissions.push({ id: id, permission: true, type: 'ROLE' }),
          );
        }
        if (this._options.permissions.roles.deny) {
          this._options.permissions.roles.deny.forEach(id =>
            permissions.push({ id: id, permission: false, type: 'ROLE' }),
          );
        }
      }
      if (this._options.permissions.users) {
        if (this._options.permissions.users.allow) {
          this._options.permissions.users.allow.forEach(id =>
            permissions.push({ id: id, permission: true, type: 'USER' }),
          );
        }
        if (this._options.permissions.users.deny) {
          this._options.permissions.users.deny.forEach(id =>
            permissions.push({ id: id, permission: false, type: 'USER' }),
          );
        }
      }
    }

    return permissions.length ? permissions : undefined;
  }

  isGlobal(): boolean {
    return this._options.type === 'global';
  }
}
