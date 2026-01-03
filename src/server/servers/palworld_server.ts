import ServerManager from '../server_manager.js';
import type { CacheType, ChatInputCommandInteraction } from 'discord.js';
import Utils from '../../misc/utils.js';
import axios, { HttpStatusCode, type AxiosBasicCredentials } from 'axios';
import humanizeDuration from 'humanize-duration';
import Server from '../modules/server.js';

export default class PalworldServer extends Server {
  constructor(manager: ServerManager) {
    super('Palworld', manager);
  }

  parseGameVersion(log: string): string | undefined {
    if (Utils.hasAny(log, 'Game version')) {
      return log.split('Game version is ')[1];
    }
  }

  parseReady(log: string): boolean {
    return Utils.hasAny(log, 'Running Palworld dedicated server on');
  }

  apiURL(path: string) {
    const port = this.process?.executable.apiPort;
    if (!port) return;

    const url = new URL(path, `http://localhost:${port}/v1/api/`);
    return url.href;
  }

  apiAuth(): AxiosBasicCredentials | undefined {
    const user = this.process?.executable.apiUser;
    const password = this.process?.executable.apiPassword;
    if (!user || !password) return;

    return {
      username: user,
      password: password,
    };
  }

  async getServerInfo(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    if (!this.apiAuth()) {
      await interaction.reply('Palworld Dedicated Server API Credentials are not set.');
      return;
    }

    await interaction.deferReply();

    const resInfo = await axios({
      method: 'get',
      url: this.apiURL('info'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
      headers: {
        Accept: 'application/json',
      },
    });

    if (resInfo.status !== HttpStatusCode.Ok) {
      await interaction.editReply(`Failed to process request: \`${resInfo.statusText}\``);
      return;
    }

    const resMetrics = await axios({
      method: 'get',
      url: this.apiURL('metrics'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
      headers: {
        Accept: 'application/json',
      },
    });

    if (resMetrics.status !== HttpStatusCode.Ok) {
      await interaction.editReply(`Failed to process request: \`${resMetrics.statusText}\``);
      return;
    }

    const serverInfo = [
      `**${resInfo.data.servername}**`,
      `Version: ${resInfo.data.version}`,
      `Uptime: ${humanizeDuration(resMetrics.data.uptime * 1000)}`,
      `In-game Days: ${resMetrics.data.days} days`,
      `Players Online: ${resMetrics.data.currentplayernum} / ${resMetrics.data.maxplayernum}`,
    ];

    await interaction.editReply(serverInfo.join('\n'));
  }

  async getPlayers(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    if (!this.apiAuth()) {
      await interaction.reply('Palworld Dedicated Server API Credentials are not set.');
      return;
    }

    await interaction.deferReply();

    const res = await axios({
      method: 'get',
      url: this.apiURL('players'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.status !== HttpStatusCode.Ok) {
      await interaction.editReply(`Failed to process request: \`${res.statusText}\``);
      return;
    }

    const players: [] = res.data.players.map(
      (p: { accountName: string; name: string; level: number; ping: number }) => {
        const playerInfo = [
          `**${p.accountName}**`,
          `  Name: ${p.name}`,
          `  Level: ${p.level}`,
          `  Ping: ${p.ping}`,
        ];

        return playerInfo.join('\n');
      },
    );

    const message = players.length > 0 ? players.join('\n') : 'No players online.';
    await interaction.editReply(message);
  }

  async save(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    if (!this.apiAuth()) {
      await interaction.reply('Palworld Dedicated Server API Credentials are not set.');
      return;
    }

    await interaction.deferReply();

    const res = await axios({
      method: 'post',
      url: this.apiURL('save'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
    });

    if (res.status !== HttpStatusCode.Ok) {
      await interaction.editReply(`Failed to process request: \`${res.statusText}\``);
      return;
    }

    await axios({
      method: 'post',
      url: this.apiURL('announce'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        message: `${interaction.user.displayName} performed Save.`,
      }),
    });

    await interaction.editReply('Game successfully saved.');
  }

  async shutdown(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    if (!this.apiAuth()) {
      await interaction.reply('Palworld Dedicated Server API Credentials are not set.');
      return;
    }

    await interaction.deferReply();

    const res = await axios({
      method: 'post',
      url: this.apiURL('shutdown'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        waittime: 30,
        message: [
          `Shutdown initiated by ${interaction.user.displayName}.`,
          'The server will shutdown in 30 seconds.',
        ].join('\n'),
      }),
    });

    if (res.status !== HttpStatusCode.Ok) {
      await interaction.editReply(`Failed to process request: \`${res.statusText}\``);
      return;
    }

    await interaction.editReply('The server will shutdown in 30 seconds.');
  }

  async stop(interaction: ChatInputCommandInteraction<CacheType>) {
    if (this.notReady(interaction)) return;

    if (!this.apiAuth()) {
      await interaction.reply('Palworld Dedicated Server API Credentials are not set.');
      return;
    }

    await interaction.deferReply();

    const res = await axios({
      method: 'post',
      url: this.apiURL('stop'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
    });

    if (res.status !== HttpStatusCode.Ok) {
      await interaction.editReply(`Failed to process request: \`${res.statusText}\``);
      return;
    }

    await interaction.editReply('Force shutdown initiated.');
  }
}
