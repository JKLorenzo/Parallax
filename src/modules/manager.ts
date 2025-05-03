import Telemetry from '../telemetry/telemetry.js';
import type { TelemetryOptions } from '../telemetry/telemetry_defs.js';

export default abstract class Manager {
  telemetry: Telemetry;

  constructor(telemetryOptions?: Omit<TelemetryOptions, 'parent'>) {
    this.telemetry = new Telemetry(this.constructor.name, {
      ...telemetryOptions,
    });
  }
}
