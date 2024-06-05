import TelemetryNode from './telemetry_node.js';

export default abstract class Telemetry {
  telemetry: TelemetryNode;

  constructor(options?: { broadcast?: boolean; identifier?: string }) {
    const alias = this.constructor.name + (options?.identifier ? `(${options.identifier})` : '');
    console.log(`[${alias}] Telemetry Registered`);
    this.telemetry = new TelemetryNode(alias, options?.broadcast ?? true);
  }
}
