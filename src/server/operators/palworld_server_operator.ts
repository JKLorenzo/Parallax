import ServerManager from '../server_manager.js';
import Telemetry from '../../telemetry/telemetry.js';
import Process from '../../modules/process.js';
import type { CacheType, ChatInputCommandInteraction } from 'discord.js';
import Utils from '../../misc/utils.js';
import axios, { type AxiosBasicCredentials } from 'axios';
import humanizeDuration from 'humanize-duration';
import DatabaseFacade from '../../database/database_facade.js';

export default class PalworldServerOperator {
  private telemetry: Telemetry;

  private process?: Process;

  private gameVersion?: string;

  constructor(manager: ServerManager) {
    this.telemetry = new Telemetry(this.constructor.name, {
      parent: manager.telemetry,
    });
  }

  async info() {
    const info: string[] = [];

    const connectionInfo = await this.process?.connectionInfo();
    if (connectionInfo) info.push(connectionInfo);
    if (this.gameVersion) info.push(`Game version: \`${this.gameVersion}\``);

    return info.length > 0 ? info.join('\n') : 'No information available.';
  }

  async start(interaction: ChatInputCommandInteraction<CacheType>) {
    const sm = ServerManager.instance();

    const executable = sm.executables.find(e => e.name === 'Palworld Dedicated Server');
    if (!executable) return await interaction.reply('Could not find the executable information.');

    if (this.process?.executable === executable) {
      const info = await this.info();
      return await interaction.reply(info);
    } else if (this.process) {
      return await interaction.reply('Could not start when a similar process is running.');
    }

    await interaction.deferReply();

    this.process = new Process(executable, this.telemetry);
    const pid = await this.process.run();
    if (!pid) return `Palworld failed to start due to an error.`;

    this.process.once('stdlog', async (log, process) => {
      await interaction.editReply('Starting Palworld Dedicated Server...');
      await ServerManager.instance().addActivity(process.executable);
    });

    this.process.once('close', async (code, process) => {
      this.process?.removeAllListeners();
      this.process = undefined;
      await ServerManager.instance().removeActivity(process.executable);
    });

    this.process.on('stdlog', async log => {
      if (Utils.hasAny(log, 'Game version')) {
        this.gameVersion = log.split('Game version is ')[1];
      }

      if (Utils.hasAny(log, 'Running Palworld dedicated server on')) {
        this.process?.removeAllListeners('stdlog');
        const info = await this.info();
        await interaction.editReply(info);
      }
    });
  }

  async update(interaction: ChatInputCommandInteraction<CacheType>) {
    const sm = ServerManager.instance();

    const executable = sm.executables.find(e => e.name === 'Palworld Update');
    if (!executable) return await interaction.reply('Could not find the executable information.');

    if (this.process?.executable === executable) {
      const info = await this.info();
      return await interaction.reply(info);
    } else if (this.process) {
      return await interaction.reply('Could not start when a similar process is running.');
    }

    await interaction.deferReply();

    this.process = new Process(executable, this.telemetry);
    const pid = await this.process.run();
    if (!pid) return 'Palworld failed to update due to an error.';

    this.process.once('stdlog', async (log, process) => {
      await interaction.editReply('Updating Palworld...');
      ServerManager.instance().addActivity(process.executable);
    });

    this.process.once('close', (code, process) => {
      ServerManager.instance().removeActivity(process.executable);
      this.process?.removeAllListeners();
      this.process = undefined;
    });

    this.process.on('stdlog', async log => {
      if (Utils.hasAny(log, 'Update state')) {
        await interaction.editReply(`\`\`\`ansi\n${log}\n\`\`\``);
      }

      if (Utils.hasAny(log, 'Success!')) {
        this.gameVersion = undefined;
        this.process?.removeAllListeners('stdlog');
        await interaction.editReply('Palworld has been updated successfully.');
      }
    });
  }

  apiURL(path: string) {
    const port = this.process?.executable.apiPort;
    if (!port) return;

    const url = new URL(path, `http://localhost:${port}/v1/api/`);
    console.log(url.href);
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
    if (!this.process || this.process.executable.name !== 'Palworld Dedicated Server') {
      await interaction.reply('Palworld Dedicated Server is not running.');
      return;
    }

    if (!this.process.executable.apiUser || !this.process.executable.apiPassword) {
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

    const resMetrics = await axios({
      method: 'get',
      url: this.apiURL('metrics'),
      auth: this.apiAuth(),
      maxBodyLength: Infinity,
      headers: {
        Accept: 'application/json',
      },
    });

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
    if (!this.process || this.process.executable.name !== 'Palworld Dedicated Server') {
      await interaction.reply('Palworld Dedicated Server is not running.');
      return;
    }

    if (!this.process.executable.apiUser || !this.process.executable.apiPassword) {
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
    if (!this.process || this.process.executable.name !== 'Palworld Dedicated Server') {
      await interaction.reply('Palworld Dedicated Server is not running.');
      return;
    }

    if (!this.process.executable.apiUser || !this.process.executable.apiPassword) {
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

    await interaction.editReply(res.data);
  }

  async shutdown(interaction: ChatInputCommandInteraction<CacheType>) {
    if (!this.process || this.process.executable.name !== 'Palworld Dedicated Server') {
      await interaction.reply('Palworld Dedicated Server is not running.');
      return;
    }

    if (!this.process.executable.apiUser || !this.process.executable.apiPassword) {
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

    await interaction.editReply(res.data);
  }

  async stop(interaction: ChatInputCommandInteraction<CacheType>) {
    const db = DatabaseFacade.instance();
    const ownerId = await db.botConfig('BotOwnerId');

    if (interaction.user.id !== ownerId) {
      await interaction.reply("You don't have a permission to use this command.");
      return;
    }

    if (!this.process || this.process.executable.name !== 'Palworld Dedicated Server') {
      await interaction.reply('Palworld Dedicated Server is not running.');
      return;
    }

    if (!this.process.executable.apiUser || !this.process.executable.apiPassword) {
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

    await interaction.editReply(res.data);
  }
}
