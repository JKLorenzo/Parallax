import { ChildProcess, spawn } from 'node:child_process';
import type { Executable } from '../database/database_defs.js';
import { publicIpv4 } from 'public-ip';
import Telemetry from '../telemetry/telemetry.js';
import EnvironmentFacade from '../environment/environment_facade.js';
import Utils from '../misc/utils.js';
import EventEmitter from 'node:events';
import { client } from '../main.js';
import { CSConstants } from '../misc/constants.js';
import { CategoryChannel, ChannelType, TextChannel } from 'discord.js';

interface ProcessEvents {
  stdlog: [log: string, process: Process];
  stderr: [error: string, process: Process];
  close: [code: number | null, process: Process];
}

export default class Process extends EventEmitter<ProcessEvents> {
  readonly executable: Executable;
  readonly telemetry: Telemetry;

  private childProcess?: ChildProcess;
  private outputBuffer: string[];
  private isSending: boolean;

  constructor(executable: Executable, operatorTelemetry: Telemetry) {
    super();

    this.executable = executable;
    this.telemetry = new Telemetry(this.constructor.name, {
      id: executable.name,
      parent: operatorTelemetry,
    });

    this.outputBuffer = [];
    this.isSending = false;
  }

  get name() {
    return this.executable.name;
  }

  get pid() {
    return this.childProcess?.pid;
  }

  async connectionInfo() {
    const ipv4 = await publicIpv4();
    return this.executable.connectionInfo.replaceAll('<ipv4>', ipv4).replaceAll('`', `\``);
  }

  async run() {
    const telemetry = new Telemetry(this.run, { parent: this.telemetry });
    const env = EnvironmentFacade.instance();

    this.childProcess = spawn(Utils.joinPaths(...this.executable.path), this.executable.args, {
      cwd: Utils.joinPaths(env.cwd, '../../../'),
      detached: true,
    });

    this.childProcess.stdout?.on('data', data => {
      for (const line of `${data}`.split('\n')) {
        if (line.trim().length === 0) continue;
        this.processOutput(this.name, line);
        this.emit('stdlog', line, this);
      }
    });

    this.childProcess.stderr?.on('data', data => {
      for (let line of `${data}`.split('\n')) {
        if (line.trim().length === 0) continue;
        this.processOutput(this.name, `\x1b[2;31m[ERR]\x1b[0m  ${line}`);
        this.emit('stdlog', line, this);
      }
    });

    this.childProcess.once('close', code => {
      this.processOutput(
        this.name,
        `Process exited${code ? ` with code \`${code}\`.` : '.'}`,
        true,
      );

      this.emit('close', code, this);
      this.childProcess?.removeAllListeners();
      this.childProcess = undefined;
    });

    telemetry.end();

    return this.pid;
  }

  write(chunk: any, callback?: (error: Error | null | undefined) => void) {
    return this.childProcess?.stdin?.write(chunk, callback);
  }

  kill(signal?: number | NodeJS.Signals) {
    const telemetry = new Telemetry(this.kill, { parent: this.telemetry });

    const pid = this.childProcess?.pid;
    if (!pid) return false;

    telemetry.end();

    return process.kill(-pid, signal);
  }

  private async processOutput(processName: string, log: string, now?: boolean) {
    const telemetry = new Telemetry(this.processOutput, { parent: this.telemetry });
    telemetry.log(log);

    const filters = this.executable.logFilters;
    if (filters && !Utils.hasAny(log, filters)) return telemetry.end();

    this.outputBuffer.push(log);

    if (this.outputBuffer.join('\n').length >= 1000) now = true;
    if (!now && this.isSending) return telemetry.end();

    this.isSending = true;
    if (!now) await Utils.sleep(5000);

    const message = [];
    while (this.outputBuffer.length > 0) {
      const data = this.outputBuffer.shift()?.trim();
      if (data?.length) message.push(data);
    }

    if (message.length) {
      const guild = client.guilds.cache.get(CSConstants.GUILD_ID);
      const categoryChannel = guild?.channels.cache.get(CSConstants.PROCESSES_CHANNEL_CATEGORY_ID);
      if (!(categoryChannel instanceof CategoryChannel)) return;

      const channelName = processName.split(' ')[0].toLowerCase();
      let channel = categoryChannel.children.cache.find(c => c.name === channelName);
      if (!channel) {
        channel = await categoryChannel.children.create({
          name: channelName,
          type: ChannelType.GuildText,
        });
      }
      if (!(channel instanceof TextChannel)) return;

      await channel.send(`\`\`\`ansi\n${message.join('\n')}\`\`\``);
    }

    this.isSending = false;

    telemetry.end();
  }
}
