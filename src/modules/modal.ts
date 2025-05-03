import type { Awaitable, ModalComponentData, ModalSubmitInteraction } from 'discord.js';
import Telemetry from '../telemetry/telemetry.js';

export default abstract class Modal {
  data: ModalComponentData;
  telemetry: Telemetry;

  constructor(data: ModalComponentData) {
    this.data = data;
    this.telemetry = new Telemetry(this);
  }

  // eslint-disable-next-line no-unused-vars
  abstract exec(interaction: ModalSubmitInteraction): Awaitable<unknown>;
}
