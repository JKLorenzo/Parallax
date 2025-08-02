import { Collection, ModalSubmitInteraction } from 'discord.js';
import type Modal from '../modules/modal.js';
import Telemetry from '../../telemetry/telemetry.js';
import type InteractionManager from '../interaction_manager.js';
import Utils from '../../misc/utils.js';
import EnvironmentFacade from '../../environment/environment_facade.js';

export default class InteractionModalOperator {
  private telemetry: Telemetry;
  private modals: Collection<string, Modal>;

  constructor(manager: InteractionManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });
    this.modals = new Collection();
  }

  async init() {
    const telemetry = this.telemetry.start(this.init);
    const env = EnvironmentFacade.instance();

    const topLevelDirs = await Utils.getPaths(env.cwd);
    const modalPaths = topLevelDirs
      .map(dir => Utils.joinPaths(dir, 'modals'))
      .filter(dir => Utils.dirExists(dir));

    for (const modalPath of modalPaths) {
      await this.load(modalPath);
    }

    telemetry.end();
  }

  async load(dir: string) {
    const telemetry = this.telemetry.start(this.load);

    const modalPathURLs = Utils.getFiles(dir)
      .filter(path => path.endsWith('.js'))
      .map(path => Utils.getPathURL(path).href);

    for (const modalPathURL of modalPathURLs) {
      const { default: Interaction } = await import(modalPathURL);
      const modal = new Interaction() as Modal;
      this.modals.set(modal.data.customId, modal);
    }

    telemetry.end();
  }

  async process(interaction: ModalSubmitInteraction) {
    const telemetry = this.telemetry.start(this.process);

    const thisModal = this.modals.get(interaction.customId);
    if (!thisModal) return;

    try {
      await thisModal.exec(interaction);
    } catch (error) {
      telemetry.error(error);
    }

    telemetry.end();
  }
}
