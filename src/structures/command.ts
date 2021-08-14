import {
  ApplicationCommand,
  ApplicationCommandData,
  ApplicationCommandOptionData,
  ApplicationCommandPermissionData,
  ApplicationCommandType,
  ClientApplication,
  CommandInteraction,
  Guild,
  Snowflake,
} from 'discord.js';
import { ApplicationCommandTypes } from 'discord.js/typings/enums.js';
import _ from 'lodash';
import { client } from '../main.js';
import { getBotConfig } from '../modules/database.js';
import { GuildCommandOptions } from '../utils/types.js';

export default abstract class Command {
  private _scope: 'guild' | 'global';
  private _data: ApplicationCommandData;
  private _ownerId?: Snowflake;
  private _options?: GuildCommandOptions;

  constructor(
    scope: 'guild' | 'global',
    data: ApplicationCommandData,
    options?: GuildCommandOptions,
  ) {
    this._scope = scope;
    this._data = {} as ApplicationCommandData;
    this._options = options;

    this.patch(data);
  }

  patch(data: ApplicationCommandData): void {
    switch (data.type) {
      case 'CHAT_INPUT':
        this._data = {
          type: 'CHAT_INPUT',
          name: data.name,
          description: data.description,
          defaultPermission: data.defaultPermission,
          options: this._transformOptions(data.options),
        };
        break;
      case 'USER':
      case 'MESSAGE':
        this._data = {
          type: data.type,
          name: data.name,
          defaultPermission: data.defaultPermission,
        };
        break;
      default:
        throw new TypeError(
          `${this.scope} ${`${this.type}`.toLowerCase()} command ${data.name} has unknown type`,
        );
    }
  }

  async init(guild?: Guild): Promise<unknown> {
    const context =
      this.scope === 'guild'
        ? guild
          ? [guild]
          : [...client.guilds.cache.values()]
        : client.application;

    if (!context) return;

    if (context instanceof ClientApplication) {
      let this_command = client.application?.commands.cache.find(
        c => c.name === this.data.name && c.type === this.data.type,
      );

      // Create
      if (!this_command) {
        this_command = await client.application?.commands.create(this.data);
        console.log(
          `${this.scope} ${`${this.type}`.toLowerCase()} command ${this.data.name} created`,
        );
      }

      // Update data
      if (this_command && !this.isUpdated(this_command)) {
        await this_command.edit(this.data);
        console.log(
          `${this.scope} ${`${this.type}`.toLowerCase()} command ${this.data.name} updated`,
        );
      }
    } else {
      if (!this._ownerId) this._ownerId = await getBotConfig('BotOwnerId');

      for (const this_guild of context) {
        await this_guild.commands.fetch();
        const hasFilter = typeof this._options?.guilds === 'function';
        let this_command = this_guild.commands.cache.find(
          c => c.name === this.data.name && c.type === this.data.type,
        );

        if (!hasFilter || (await Promise.race([this._options?.guilds!(this_guild)]))) {
          // Create
          if (!this_command) {
            this_command = await this_guild.commands.create(this.data);
            console.log(
              `${this.scope} ${`${this.type}`.toLowerCase()} command ${
                this.data.name
              } created on ${this_guild}`,
            );
          }

          // Update data
          if (this_command && !this.isUpdated(this_command)) {
            await this_command.edit(this.data);
            console.log(
              `${this.scope} ${`${this.type}`.toLowerCase()} command ${
                this.data.name
              } updated on ${this_guild}`,
            );
          }

          // Update permissions
          if (this.type === 'CHAT_INPUT') {
            const guildPermissions = await this_guild.commands.permissions.fetch({});
            const existingPermissions = guildPermissions.get(this_command.id);
            const currentPermissions = this.getPermissions();
            if (!_.isEqual(currentPermissions, existingPermissions)) {
              await this_command.permissions.set({
                permissions: currentPermissions ?? [],
              });
              console.log(
                `${this.scope} ${`${this.type}`.toLowerCase()} command ${
                  this.data.name
                } permissions updated on ${this_guild}`,
              );
            }
          }
        } else if (this_command && hasFilter) {
          // Delete
          await this_command.delete();
          console.log(
            `${this.scope} ${`${this.type}`.toLowerCase()} command ${
              this.data.name
            } deleted on ${this_guild}`,
          );
        }
      }
    }
  }

  abstract exec(interaction: CommandInteraction): Promise<unknown>;

  get data(): ApplicationCommandData {
    return _.cloneDeep(this._data);
  }

  get scope(): 'guild' | 'global' {
    return this._scope;
  }

  get type(): ApplicationCommandType | ApplicationCommandTypes {
    return this.data.type ?? 'CHAT_INPUT';
  }

  isUpdated(data: ApplicationCommand): boolean {
    if (this.data.defaultPermission !== data.defaultPermission) return false;
    if (this.data.type === 'CHAT_INPUT' && data.type === 'CHAT_INPUT') {
      if (this.data.description !== data.description) return false;
      if (JSON.stringify(this.data.options) !== JSON.stringify(data.options)) {
        console.log(this.data.name, this.data.options, data.options);
        return false;
      }
    }
    return true;
  }

  getPermissions(): ApplicationCommandPermissionData[] | undefined {
    const permissions = [] as ApplicationCommandPermissionData[];

    if (this._options?.permissions?.roles?.allow) {
      this._options.permissions.roles.allow.forEach(id =>
        permissions.push({ id: id, permission: true, type: 'ROLE' }),
      );
    }
    if (this._options?.permissions?.roles?.deny) {
      this._options.permissions.roles.deny.forEach(id =>
        permissions.push({ id: id, permission: false, type: 'ROLE' }),
      );
    }

    if (this._ownerId) {
      permissions.push({ id: this._ownerId, permission: true, type: 'USER' });
    }

    if (this._options?.permissions?.users?.allow) {
      this._options.permissions.users.allow.forEach(id =>
        permissions.push({ id: id, permission: true, type: 'USER' }),
      );
    }
    if (this._options?.permissions?.users?.deny) {
      this._options.permissions.users.deny.forEach(id =>
        permissions.push({ id: id, permission: false, type: 'USER' }),
      );
    }

    return permissions.length ? permissions : undefined;
  }

  private _transformOptions(
    options?: ApplicationCommandOptionData[],
  ): ApplicationCommandOptionData[] {
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
