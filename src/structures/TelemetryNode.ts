import type Manager from './Manager';
import type TelemetryManager from '../managers/TelemetryManager';

export default class TelemetryNode {
  manager: Manager;
  telemetry: TelemetryManager;
  section: string;

  constructor(manager: Manager, section: string) {
    this.manager = manager;
    this.telemetry = manager.bot.managers.telemetry;
    this.section = section;
  }

  logMessage(value: unknown) {
    this.telemetry.logMessage(this.manager, this.section, value);
  }

  logError(value: unknown) {
    this.telemetry.logError(this.manager, this.section, value);
  }
}
