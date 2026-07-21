import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import ServerOperator from '../modules/server_operator.js';

export default class ValheimOperator extends ServerOperator {
  constructor(manager: ServerManager) {
    super('Valheim', manager);
  }

  parseGameVersion(log: string): string | undefined {
    if (Utils.hasAll(log, ['Console: Valheim', 'network version'])) {
      return log.split('Console: Valheim ')[1];
    }
  }

  parseReady(log: string): boolean {
    return Utils.hasAll(log, ['Session', 'with join code', 'and IP', 'is active']);
  }
}
