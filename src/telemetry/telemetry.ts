import type { SendableChannels } from 'discord.js';
import Utils from '../misc/utils.js';
import { TELEMETRY_END_STR, TELEMETRY_START_STR, type TelemetryOptions } from './telemetry_defs.js';
import TelemetryFacade from './telemetry_facade.js';

export default class Telemetry {
  section: string;
  broadcast: boolean;
  id?: string;
  parent?: Telemetry;
  channel?: SendableChannels;

  constructor(section: string | object, options?: TelemetryOptions) {
    this.id = options?.id;
    this.section = Utils.getObjName(section);
    this.parent = options?.parent;
    this.broadcast = options?.broadcast ?? false;
    this.channel = options?.channel ?? options?.parent?.channel;

    this.log(TELEMETRY_START_STR, false);
  }

  get identifier() {
    return `${this.section}${this.id ? `(${this.id})` : ''}`;
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
      channel: this.channel,
      origin: this.origin,
      identifier: this.identifier,
      value,
      broadcast,
    });
    return this;
  }

  error(value: unknown) {
    TelemetryFacade.instance().logError({
      channel: this.channel,
      origin: this.origin,
      identifier: this.identifier,
      value,
      broadcast: true,
    });
    return this;
  }

  uncaughtException(value: unknown) {
    TelemetryFacade.instance().logUncaughtException({
      channel: this.channel,
      origin: this.origin,
      identifier: this.identifier,
      value,
      broadcast: true,
    });
    return this;
  }
}
