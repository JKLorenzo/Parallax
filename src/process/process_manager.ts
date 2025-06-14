import { execFile, ChildProcess } from 'node:child_process';
import Manager from '../modules/manager.js';
import EnvironmentFacade from '../environment/environment_facade.js';
import Utils from '../modules/utils.js';
import type { Executable } from '../database/database_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import { ActivityType, Colors, EmbedBuilder, type TextBasedChannel } from 'discord.js';
import Telemetry from '../telemetry/telemetry.js';
import { client } from '../main.js';
import stripAnsi from 'strip-ansi';

export default class ProcessManager extends Manager {
  private static _instance: ProcessManager;
  private _executables: Executable[];
  private process?: ChildProcess;
  private processTelemetry?: Telemetry;
  private processOutput: string[];
  private interval?: NodeJS.Timeout;

  constructor() {
    super();

    this._executables = [];
    this.processOutput = [];
  }

  static instance() {
    if (!this._instance) {
      this._instance = new ProcessManager();
    }

    return this._instance;
  }

  async init() {
    await this.updateExecutables();
  }

  get executables() {
    return this._executables;
  }

  async updateExecutables() {
    const db = DatabaseFacade.instance();
    this._executables = await db.fetchExecutables();
    return this.executables;
  }

  start(name: string, textChannel: TextBasedChannel | null) {
    const env = EnvironmentFacade.instance();
    if (this.process) return;
    if (!textChannel?.isSendable()) return;

    const executable = this.executables.find(p => p.name === name);
    if (!executable) return;

    this.process = execFile(Utils.joinPaths(...executable.path), {
      cwd: Utils.joinPaths(env.cwd, '../../../'),
      shell: true,
    });

    const pid = this.process.pid;
    if (pid) {
      this.processTelemetry = new Telemetry(name, {
        id: pid.toString(),
        parent: this.telemetry,
        broadcast: true,
        channel: textChannel,
      });

      client.user?.setActivity(name, { type: ActivityType.Playing });
    }

    this.process.stdout?.on('data', data => {
      this.processOutput.push(data);
    });

    this.process.stderr?.on('data', data => {
      this.processOutput.push(`[ERR] ${data}`);
    });

    this.process.on('close', code => {
      clearInterval(this.interval);
      this.processOutput.push(`Exited with code: ${code}`);
      this.sendOutputToChannel();
      this.process = undefined;
      client.user?.setActivity();
      this.processTelemetry?.end();
    });

    this.interval = setInterval(() => {
      this.sendOutputToChannel();
    }, 5000);

    return pid;
  }

  stop() {
    return this.process?.kill();
  }

  private async sendOutputToChannel() {
    const telemetry = new Telemetry(this.sendOutputToChannel, { parent: this.telemetry });
    if (this.processOutput.length === 0) return;

    const message = [];
    while (this.processOutput.length > 0) {
      const data = this.processOutput.shift()?.trim();
      if (data?.length) message.push(stripAnsi(data));
    }

    const embed = new EmbedBuilder({
      author: {
        name: client.user?.username ?? '',
        icon_url: client.user?.displayAvatarURL(),
      },
      title: this.processTelemetry?.identifier,
      description: `\`\`\`${message.join('\n')}\`\`\``,
      color: Colors.Blurple,
      footer: { text: `${this.processTelemetry?.origin}` },
    });

    await this.processTelemetry?.channel?.send({
      embeds: [embed],
    });

    telemetry.end();
  }
}
