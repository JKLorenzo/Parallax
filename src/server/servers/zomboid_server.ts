import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import Server from '../modules/server.js';

export default class ZomboidServer extends Server {
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
