import TelemetryFacade from './telemetry_facade.js';
import type TelemetryNode from './telemetry_node.js';

export default abstract class Telemetry {
  telemetry: TelemetryNode;

  constructor() {
    this.telemetry = TelemetryFacade.instance().register(this);
  }
}
