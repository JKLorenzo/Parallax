import { ChatInputApplicationCommandData } from 'discord.js';
import BaseCommand from './basecommand.js';
import { client } from '../main.js';

export default abstract class GlobalCommand extends BaseCommand {
  constructor(data: ChatInputApplicationCommandData) {
    super(data, 'global');
  }

  async init(): Promise<void> {
    let this_command = client.application?.commands.cache.find(
      c => c.name === this.data.name && c.type === 'CHAT_INPUT',
    );

    // Create
    if (!this_command) {
      this_command = await client.application?.commands.create(this.data);
      console.log(`Global Command ${this.data.name} created`);
    }

    // Update data
    const data = {
      name: this_command?.name,
      description: this_command?.description,
      options: this_command?.options,
      defaultPermission: this_command?.defaultPermission,
    } as ChatInputApplicationCommandData;

    if (this_command && !this.isUpdated(data)) {
      await this_command.edit(this.data);
      console.log(`Global Command ${this.data.name} updated`);
    }
  }
}
