import { Collection, MessageComponentInteraction } from 'discord.js';
import InteractionManager from '../interaction_manager.js';
import type { Component } from '../../modules/component.js';
import Telemetry from '../../telemetry/telemetry.js';
import EnvironmentFacade from '../../environment/environment_facade.js';
import Utils from '../../modules/utils.js';

export default class InteractionComponentOperator {
  private telemetry: Telemetry;
  private components: Collection<string, Component>;

  constructor(manager: InteractionManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });
    this.components = new Collection();
  }

  async init() {
    const telemetry = this.telemetry.start(this.init);
    const env = EnvironmentFacade.instance();

    const topLevelDirs = await Utils.getPaths(env.cwd);
    const componentPaths = topLevelDirs
      .map(dir => Utils.joinPaths(dir, 'components'))
      .filter(dir => Utils.dirExists(dir));

    for (const componentPath of componentPaths) {
      await this.load(componentPath);
    }

    telemetry.end();
  }

  static get Separator() {
    return '__';
  }

  async load(dir: string) {
    const telemetry = this.telemetry.start(this.load);

    const componentPathURLs = Utils.getFiles(dir)
      .filter(path => path.endsWith('.js'))
      .map(path => Utils.getPathURL(path).href);

    for (const componentPathURL of componentPathURLs) {
      const { default: Interaction } = await import(componentPathURL);
      const component = new Interaction() as Component;
      this.components.set(component.name, component);
    }

    telemetry.end();
  }

  async process(interaction: MessageComponentInteraction) {
    const telemetry = this.telemetry.start(this.process);

    const [name, customId] = interaction.customId.split(InteractionComponentOperator.Separator);
    if (!name || !customId) return;

    const thisComponent = this.components.get(name);
    if (!thisComponent) return;

    try {
      await thisComponent.exec(interaction, customId);
    } catch (error) {
      telemetry.error(error);
    }

    telemetry.end();
  }
}
