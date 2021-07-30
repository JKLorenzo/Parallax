import { ApplicationCommandData } from 'discord.js';
import BaseCommand from './command_base.js';
import { client } from '../main.js';
import { GuildCommandOptions } from '../utils/types.js';

export default abstract class GuildCommand extends BaseCommand {
  constructor(data: ApplicationCommandData, options: GuildCommandOptions) {
    super(data, {
      ...options,
      type: 'guild',
    });
  }

  async init(): Promise<void> {
    for (const guild of client.guilds.cache.array()) {
      if (this.options.guilds?.includes(guild.id)) {
        let this_command = guild.commands.cache.find(c => c.name === this.data.name);

        // Create
        if (!this_command) {
          this_command = await guild.commands.create(this.data);
          console.log(`Command ${this.data.name} created`);
        }

        // Update data
        const sameDescription = this_command.description === this.data.description;
        const sameOptions =
          JSON.stringify(this_command.options) === JSON.stringify(this.data.options);
        const sameDefaultPermissions =
          this_command.defaultPermission === this.data.defaultPermission;
        if (!sameDescription || !sameOptions || !sameDefaultPermissions) {
          if (this_command) {
            await this_command.edit(this.data);
            console.log(`Command ${this.data.name} updated`);
          }
        }

        // Update permissions
        const existingPermissions = await this_command.permissions.fetch({});
        const samePermissions =
          JSON.stringify(existingPermissions) === JSON.stringify(this.permissions);
        if (!samePermissions) {
          if (this_command) {
            await this_command.permissions.set({
              permissions: this.permissions ?? [],
            });
            console.log(`Command ${this.data.name} permission updated`);
          }
        }
      }
    }
  }
}
