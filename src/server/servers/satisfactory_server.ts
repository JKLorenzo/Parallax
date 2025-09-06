import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';
import Server from '../modules/server.js';
import axios from 'axios';
import type { CacheType, ChatInputCommandInteraction } from 'discord.js';
import humanizeDuration from 'humanize-duration';
import { Agent } from 'https';
import Telemetry from '../../telemetry/telemetry.js';

export default class SatisfactoryServer extends Server {
  private agent: Agent;

  constructor(manager: ServerManager) {
    super('Satisfactory', manager);

    this.agent = new Agent({ rejectUnauthorized: false });
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

  async apiRequest(fn: string, data?: unknown) {
    const port = this.process?.executable.apiPort;
    const token = this.process?.executable.apiToken;
    if (!port || !token) throw new Error('Environmental variables not set.');

    const res = await axios({
      method: 'POST',
      url: `https://localhost:${port}/api/v1/`,
      httpsAgent: this.agent,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        function: fn,
        data: data,
      }),
    });

    return res.data?.data;
  }

  async getServerInfo(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    const telemetry = new Telemetry(this.getServerInfo, { parent: this.telemetry });

    await interaction.deferReply();

    try {
      const data = await this.apiRequest('QueryServerState');

      const serverInfo = [
        `Session: \`${data.serverGameState.activeSessionName}\``,
        `Version: \`${this.gameVersion}\``,
        `State: \`${data.serverGameState.isGameRunning ? (data.serverGameState.isGamePaused ? 'Paused' : 'Running') : 'Waiting to Load'}\``,
        `Duration: \`${humanizeDuration(data.serverGameState.totalGameDuration * 1000)}\``,
        `Tick Rate: \`${data.serverGameState.averageTickRate}\``,
        `Tech Tier: \`${data.serverGameState.techTier}\``,
        `Players Online: \`${data.serverGameState.numConnectedPlayers} / ${data.serverGameState.playerLimit}\``,
      ];

      await interaction.editReply(serverInfo.join('\n'));
    } catch (err) {
      telemetry.error(err);
      await interaction.editReply(`An error has occurred:\n${err}`);
    }

    telemetry.end();
  }

  async save(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    const telemetry = new Telemetry(this.save, { parent: this.telemetry });

    await interaction.deferReply();

    try {
      await this.apiRequest('SaveGame', { SaveName: `${interaction.user.id}-${Date.now()}` });

      await interaction.editReply('The game is saved.');
    } catch (err) {
      telemetry.error(err);
      await interaction.editReply(`An error has occurred:\n${err}`);
    }
  }

  async shutdown(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    const telemetry = new Telemetry(this.shutdown, { parent: this.telemetry });

    await interaction.deferReply();

    try {
      await this.apiRequest('Shutdown');

      await interaction.editReply('The game is shutting down.');
    } catch (err) {
      telemetry.error(err);
      await interaction.editReply(`An error has occurred:\n${err}`);
    }
  }
}
