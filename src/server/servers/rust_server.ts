import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import Server from '../../modules/server.js';
import type { CacheType, ChatInputCommandInteraction } from 'discord.js';

export default class RustServer extends Server {
  constructor(manager: ServerManager) {
    super('Rust', manager);
  }

  parseGameVersion(log: string): string | undefined {
    return undefined;
  }

  parseReady(log: string): boolean {
    return Utils.hasAny(log, 'Session creation completed.');
  }
}
