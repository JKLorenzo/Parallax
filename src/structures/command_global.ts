import { ApplicationCommandData } from 'discord.js';
import BaseCommand from './command_base.js';
import { client } from '../main.js';

export default abstract class GlobalCommand extends BaseCommand {
  constructor(data: ApplicationCommandData) {
    super(data, 'global');
  }

  async init(): Promise<void> {
    let this_command = client.application?.commands.cache.find(c => c.name === this.data.name);

    // Create
    if (!this_command) {
      this_command = await client.application?.commands.create(this.data);
      console.log(`Global Command ${this.data.name} created`);
    }

    // Update data
    if (this_command && !this.isUpdated(this_command)) {
      await this_command.edit(this.data);
      console.log(`Global Command ${this.data.name} updated`);
    }
  }
}
