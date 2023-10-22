import TelemetryFacade from './telemetry_facade.js';
import type TelemetryNode from './telemetry_node.js';
import Utils from '../../static/utils.js';

export default class TelemetryLogger {
  private node: TelemetryNode;
  private section: string;
  private broadcast: boolean;

  constructor(node: TelemetryNode, section: string | object, broadcast: boolean) {
    this.node = node;
    this.section = Utils.getObjName(section);
    this.broadcast = broadcast;
    this.log('------START------', false);
  }

  end() {
    this.log('-------END-------', false);
  }

  log(value: unknown, broadcast = this.broadcast) {
    TelemetryFacade.instance().logMessage({
      origin: this.node.origin,
      section: this.section,
      value: value,
      broadcast: broadcast,
    });
  }

  error(value: unknown, broadcast = this.broadcast) {
    TelemetryFacade.instance().logError({
      origin: this.node.origin,
      section: this.section,
      value: value,
      broadcast: broadcast,
    });
  }
}
