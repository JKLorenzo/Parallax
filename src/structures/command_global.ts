import { ApplicationCommandData } from 'discord.js';
import BaseCommand from './command_base.js';
import { client } from '../main.js';

export default abstract class GlobalCommand extends BaseCommand {
  constructor(data: ApplicationCommandData) {
    super(data, { type: 'global' });
  }

  async init(): Promise<void> {
    let this_command = client.application?.commands.cache.find(c => c.name === this.data.name);

    // Create
    if (!this_command) {
      this_command = await client.application?.commands.create(this.data);
      console.log(`Command ${this.data.name} created`);
    }

    // Update data
    const sameDescription = this_command?.description === this.data.description;
    const sameOptions = JSON.stringify(this_command?.options) === JSON.stringify(this.data.options);
    const sameDefaultPermissions = this_command?.defaultPermission === this.data.defaultPermission;
    if (this_command && (!sameDescription || !sameOptions || !sameDefaultPermissions)) {
      await this_command.edit(this.data);
      console.log(`Command ${this.data.name} updated`);
    }
  }
}
