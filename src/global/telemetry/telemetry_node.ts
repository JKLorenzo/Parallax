import TelemetryLogger from './telemetry_logger.js';

export default class TelemetryNode {
  origin: string;
  broadcast: boolean;

  constructor(origin: string, broadcast: boolean) {
    this.origin = origin;
    this.broadcast = broadcast;
  }

  start(section: string | object, broadcast = this.broadcast) {
    return new TelemetryLogger(this, section, broadcast);
  }
}
