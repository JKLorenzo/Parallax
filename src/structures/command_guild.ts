import { ApplicationCommandData, ApplicationCommandPermissionData } from 'discord.js';
import BaseCommand from './command_base.js';
import { client } from '../main.js';
import { GuildCommandOptions } from '../utils/types.js';

export default abstract class GuildCommand extends BaseCommand {
  private _options: GuildCommandOptions;

  constructor(data: ApplicationCommandData, options: GuildCommandOptions) {
    super(data, 'guild');
    this._options = options;
  }

  async init(): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
      if (!this._options.guilds || (await Promise.race([this._options.guilds(guild)]))) {
        await guild.commands.fetch();
        let this_command = guild.commands.cache.find(c => c.name === this.data.name);

        // Create
        if (!this_command) {
          this_command = await guild.commands.create(this.data);
          console.log(`Guild Command ${this.data.name} created on ${guild}`);
        }

        // Update data
        if (!this.isUpdated(this_command)) {
          await this_command.edit(this.data);
          console.log(`Guild Command ${this.data.name} updated on ${guild}`);
        }

        // Update permissions
        const guildPermissions = await guild.commands.permissions.fetch({});
        const existingPermissions = guildPermissions.get(this_command.id);
        if (JSON.stringify(existingPermissions) !== JSON.stringify(this.permissions)) {
          await this_command.permissions.set({
            permissions: this.permissions ?? [],
          });
          console.log(`Guild Command ${this.data.name} permission updated on ${guild}`);
        }
      }
    }
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
}
