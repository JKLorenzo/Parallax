import type TelemetryManager from '../managers/telemetry_manager.js';

export default class TelemetryNode {
  telemetry: TelemetryManager;
  origin: string;
  section: string;
  broadcast: boolean;

  constructor(telemetry: TelemetryManager, origin: string, section: string, broadcast: boolean) {
    this.telemetry = telemetry;
    this.origin = origin;
    this.section = section;
    this.broadcast = broadcast;
  }

  logMessage(value: unknown, broadcast = this.broadcast) {
    this.telemetry.logMessage({
      origin: this.origin,
      section: this.section,
      value: value,
      broadcast: broadcast,
    });
  }

  logError(value: unknown, broadcast = this.broadcast) {
    this.telemetry.logError({
      origin: this.origin,
      section: this.section,
      value: value,
      broadcast: broadcast,
    });
  }
}
