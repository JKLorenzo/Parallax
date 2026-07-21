import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import ServerOperator from '../modules/server_operator.js';
import type { CacheType, ChatInputCommandInteraction } from 'discord.js';

export default class AbioticFactorOperator extends ServerOperator {
  constructor(manager: ServerManager) {
    super('Abiotic Factor', manager);
  }

  parseGameVersion(log: string): string | undefined {
    return undefined;
  }

  parseReady(log: string): boolean {
    return Utils.hasAny(log, 'Match State Changed from EnteringMap to WaitingToStart');
  }

  async stop(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    const killed = this.process?.kill();
    if (!killed) return await interaction.reply('Failed to shut down the server.');

    await interaction.reply('The game is shutting down.');
  }
}
