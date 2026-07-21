import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import ServerOperator from '../modules/server_operator.js';

export default class RustOperator extends ServerOperator {
  constructor(manager: ServerManager) {
    super('Rust', manager);
  }

  parseGameVersion(log: string): string | undefined {
    return undefined;
  }

  parseReady(log: string): boolean {
    return Utils.hasAny(log, 'Server startup complete');
  }
}
