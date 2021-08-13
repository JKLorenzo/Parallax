import {
  ApplicationCommandPermissionData,
  ChatInputApplicationCommandData,
  Guild,
  Snowflake,
} from 'discord.js';
import BaseCommand from './basecommand.js';
import { client } from '../main.js';
import { getBotConfig } from '../modules/database.js';
import { GuildCommandOptions } from '../utils/types.js';

export default abstract class GuildCommand extends BaseCommand {
  private _options?: GuildCommandOptions;
  private _ownerId?: Snowflake;

  constructor(data: ChatInputApplicationCommandData, options?: GuildCommandOptions) {
    super(data, 'guild');
    this._options = options;
  }

  async init(this_guild?: Guild): Promise<void> {
    this._ownerId = await getBotConfig('BotOwnerId');

    for (const guild of this_guild ? [this_guild] : client.guilds.cache.values()) {
      await guild.commands.fetch();
      const isFiltered = typeof this._options?.guilds === 'function';
      let this_command = guild.commands.cache.find(c => c.name === this.data.name);

      if (!isFiltered || (await Promise.race([this._options?.guilds!(guild)]))) {
        // Create
        if (!this_command) {
          this_command = await guild.commands.create(this.data);
          console.log(`Guild Command ${this.data.name} created on ${guild}`);
        }

        // Update data
        const data = {
          name: this_command?.name,
          description: this_command?.description,
          options: this_command?.options,
          defaultPermission: this_command?.defaultPermission,
        } as ChatInputApplicationCommandData;

        if (!this.isUpdated(data)) {
          await this_command.edit(this.data);
          console.log(`Guild Command ${this.data.name} updated on ${guild}`);
        }

        // Update permissions
        const guildPermissions = await guild.commands.permissions.fetch({});
        const existingPermissions = guildPermissions.get(this_command.id);
        const currentPermissions = this.getPermissions();
        if (JSON.stringify(existingPermissions) !== JSON.stringify(currentPermissions)) {
          await this_command.permissions.set({
            permissions: currentPermissions ?? [],
          });
          console.log(`Guild Command ${this.data.name} permission updated on ${guild}`);
        }
      } else if (isFiltered && this_command) {
        // Delete
        await this_command.delete();
        console.log(`Guild Command ${this.data.name} deleted on ${guild}`);
      }
    }
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
}
