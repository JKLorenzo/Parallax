import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import Server from '../../modules/server.js';

export default class SatisfactoryServer extends Server {
  constructor(manager: ServerManager) {
    super('Satisfactory', manager);
  }

  parseGameVersion(log: string): string | undefined {
    if (Utils.hasAny(log, 'Set ProjectVersion to')) {
      return log
        .split(' ')
        .find(l => l.startsWith('++FactoryGame+'))
        ?.replace('++FactoryGame+rel-', '');
    }
  }

  parseReady(log: string): boolean {
    return Utils.hasAny(log, 'Match State Changed from EnteringMap to WaitingToStart');
  }
}
