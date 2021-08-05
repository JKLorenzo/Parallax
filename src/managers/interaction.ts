import { join } from 'path';
import { pathToFileURL } from 'url';
import {
  Collection,
  CommandInteraction,
  MessageActionRowOptions,
  MessageComponentInteraction,
} from 'discord.js';
import { client } from '../main.js';
import { logError } from '../modules/telemetry.js';
import BaseCommand from '../structures/command_base.js';
import Component from '../structures/component.js';
import { getFiles } from '../utils/functions.js';

const _commands = new Collection<string, BaseCommand>();
const _components = new Collection<string, Component>();

export async function initInteraction(): Promise<void> {
  try {
    const commands_dir = join(process.cwd(), 'dist/commands');
    for (const command_path of getFiles(commands_dir)) {
      if (command_path.endsWith('.map')) continue;
      const file_path = pathToFileURL(command_path).href;
      const { default: ApplicationCommand } = await import(file_path);
      const command = new ApplicationCommand() as BaseCommand;
      _commands.set(command.data.name, command);
    }

    const components_dir = join(process.cwd(), 'dist/components');
    for (const component_path of getFiles(components_dir)) {
      if (component_path.endsWith('.map')) continue;
      const file_path = pathToFileURL(component_path).href;
      const { default: MessageComponent } = await import(file_path);
      const component = new MessageComponent() as Component;
      _components.set(component.name, component);
    }

    const promises = [];
    await client.application?.commands.fetch();
    for (const command of _commands.values()) {
      promises.push(command.init());
    }
    await Promise.all(promises);
  } catch (error) {
    console.error(error);
    logError('Interaction', 'Initialize', error);
  }

  client.on('interactionCreate', interaction => {
    if (interaction.isCommand()) {
      return processCommand(interaction);
    } else if (interaction.isMessageComponent()) {
      return processComponent(interaction);
    }
  });
}

export function getComponent(name: string): MessageActionRowOptions[] | undefined {
  return _components.get(name)?.options;
}

async function processCommand(interaction: CommandInteraction): Promise<void> {
  const this_command = _commands.get(interaction.commandName);
  if (!this_command) return;
  try {
    await this_command.exec(interaction);
  } catch (error) {
    console.error(error);
    logError('Interaction', 'Process Command', error);
  }
}

async function processComponent(interaction: MessageComponentInteraction): Promise<void> {
  const [name, customId] = interaction.customId.split('__');
  const this_component = _components.get(name);
  if (!this_component) return;
  try {
    await this_component.exec(interaction, customId);
  } catch (error) {
    console.error(error);
    logError('Interaction', 'Process Component', error);
  }
}
