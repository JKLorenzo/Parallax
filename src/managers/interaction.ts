import { join } from 'path';
import { pathToFileURL } from 'url';
import Discord, {
  Collection,
  CommandInteraction,
  MessageActionRowOptions,
  MessageComponentInteraction,
} from 'discord.js';
import { client } from '../main.js';
import { logError, logMessage } from '../modules/telemetry.js';
import Command from '../structures/command.js';
import Component from '../structures/component.js';
import { getFiles } from '../utils/functions.js';

const _commands = new Collection<string, Command>();
const _components = new Collection<string, Component>();

export async function initInteraction(): Promise<void> {
  try {
    // Load components
    const components_dir = join(process.cwd(), 'dist/components');
    for (const component_path of getFiles(components_dir)) {
      if (component_path.endsWith('.map')) continue;
      const file_path = pathToFileURL(component_path).href;
      const { default: MessageComponent } = await import(file_path);
      const component = new MessageComponent() as Component;
      _components.set(component.name, component);
    }

    // Load commands
    const commands_dir = join(process.cwd(), 'dist/commands');
    for (const command_path of getFiles(commands_dir)) {
      if (command_path.endsWith('.map')) continue;
      const file_path = pathToFileURL(command_path).href;
      const { default: ApplicationCommand } = await import(file_path);
      const command = new ApplicationCommand() as Command;
      _commands.set(command.data.name, command);
    }

    // Initialize commands
    await client.application?.commands.fetch();
    for (const command of _commands.values()) {
      await command.init();
    }

    // Delete invalid commands
    const promises = [] as Promise<Discord.ApplicationCommand>[];

    client.application?.commands.cache
      .filter(cmd => !_commands.some(c => c.data.name === cmd.name && c.scope === 'global'))
      .forEach(cmd => promises.push(cmd.delete()));

    client.guilds.cache.forEach(guild =>
      guild.commands.cache
        .filter(cmd => !_commands.some(c => c.data.name === cmd.name && c.scope === 'guild'))
        .forEach(cmd => promises.push(cmd.delete())),
    );

    const deleted_commands = await Promise.all(promises);
    for (const command of deleted_commands) {
      if (command.guildId) {
        logMessage('Interaction', `Guild Command ${command.name} deleted on ${command.guild}`);
      } else {
        logMessage('Interaction', `Global Command ${command.name} deleted`);
      }
    }
  } catch (error) {
    logError('Interaction', 'Initialize', error);
  }

  client.on('interactionCreate', interaction => {
    if (interaction.isCommand() || interaction.isContextMenu()) {
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
    logError('Interaction', 'Process Component', error);
  }
}
