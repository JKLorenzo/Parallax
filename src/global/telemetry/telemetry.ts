import { TELEMETRY_END_STR, TELEMETRY_START_STR, type TelemetryOptions } from './telemetry_defs.js';
import TelemetryFacade from './telemetry_facade.js';
import Utils from '../../static/utils.js';

export default class Telemetry {
  id: string;
  section: string;
  parent?: Telemetry;
  broadcast: boolean;

  constructor(section: string | object, options?: TelemetryOptions) {
    this.id = options?.id ?? Utils.makeId(3);
    this.section = Utils.getObjName(section);
    this.parent = options?.parent;
    this.broadcast = options?.broadcast ?? false;

    this.log(TELEMETRY_START_STR, false);
  }

  get identifier() {
    return `${this.section}(${this.id})`;
  }

  get origin() {
    const identifiers = [];

    let telemetry = this.parent;
    while (telemetry instanceof Telemetry) {
      identifiers.push(telemetry.identifier);
      telemetry = telemetry.parent;
    }

    return identifiers.reverse().join('::');
  }

  start(section: string | object, broadcast = this.broadcast) {
    return new Telemetry(section, { broadcast, parent: this });
  }

  end() {
    this.log(TELEMETRY_END_STR, false);
  }

  log(value: unknown, broadcast = this.broadcast) {
    TelemetryFacade.instance().logMessage({
      origin: this.origin,
      identifier: this.identifier,
      value,
      broadcast,
    });
    return this;
  }

  error(value: unknown, broadcast = this.broadcast) {
    TelemetryFacade.instance().logError({
      origin: this.origin,
      identifier: this.identifier,
      value,
      broadcast,
    });
    return this;
  }
}
