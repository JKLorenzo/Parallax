import { join } from 'path';
import { pathToFileURL } from 'url';
import { Collection, CommandInteraction } from 'discord.js';
import { client } from '../main.js';
import BaseCommand from '../structures/command_base.js';
import { getFiles } from '../utils/functions.js';

const _commands = new Collection<string, BaseCommand>();

export async function initInteractions(): Promise<void> {
  const commands_dir = join(process.cwd(), 'dist/commands');
  for (const command_path of getFiles(commands_dir)) {
    if (command_path.endsWith('.map')) continue;
    const file_path = pathToFileURL(command_path).href;
    const { default: ApplicationCommand } = await import(file_path);
    const command = new ApplicationCommand() as BaseCommand;
    _commands.set(command.data.name, command);
  }

  client.on('interactionCreate', interaction => {
    if (interaction.isCommand()) {
      return processCommand(interaction);
    }
  });

  await syncCommands();
}

export async function syncCommands(): Promise<void> {
  const promises = [];
  await client.application?.commands.fetch();
  for (const command of _commands.array()) {
    promises.push(command.init());
  }
  await Promise.all(promises);
}

async function processCommand(interaction: CommandInteraction): Promise<void> {
  const this_command = _commands.get(interaction.commandName);
  if (!this_command) return;
  try {
    await this_command.exec(interaction);
  } catch (error) {
    console.error(error);
  }
}
