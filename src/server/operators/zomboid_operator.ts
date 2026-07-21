import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import ServerOperator from '../modules/server_operator.js';

export default class ZomboidOperator extends ServerOperator {
  constructor(manager: ServerManager) {
    super('Zomboid', manager);
  }

  parseGameVersion(log: string): string | undefined {
    if (Utils.hasAll(log, ['LOG  : General', 'version='])) {
      return log.split('version=')[1].split(' ')[0];
    }
  }

  parseReady(log: string): boolean {
    return Utils.hasAny(log, '*** SERVER STARTED ***');
  }
}
