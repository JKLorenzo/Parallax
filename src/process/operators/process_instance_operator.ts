import { TextChannel, type SendableChannels } from 'discord.js';
import { ChildProcess, spawn } from 'node:child_process';
import type { Executable } from '../../database/database_defs.js';
import ProcessManager from '../process_manager.js';
import Telemetry from '../../telemetry/telemetry.js';
import Utils from '../../misc/utils.js';
import { client } from '../../main.js';
import EnvironmentFacade from '../../environment/environment_facade.js';

export default class ProcessInstanceOperator {
  private telemetry: Telemetry;

  readonly executable: Executable;

  private process?: ChildProcess;
  private channel: SendableChannels;
  private outputBuffer: string[];
  private isSending: boolean;

  constructor(manager: ProcessManager, executable: Executable, channel: SendableChannels) {
    this.telemetry = new Telemetry(this.constructor.name, {
      id: executable.name,
      parent: manager.telemetry,
    });

    this.executable = executable;
    this.channel = channel;

    this.outputBuffer = [];
    this.isSending = false;

    client.on('messageCreate', message => {
      if (!(this.channel instanceof TextChannel)) return;
      if (!(message.channel instanceof TextChannel)) return;

      if (message.author.bot) return;
      if (message.channelId !== this.channel?.id) return;
      if (message.channel.topic !== this.channel.topic) return;
      if (message.content.length === 0) return;

      this.process?.stdin?.write(`${message.content}\r\n`, err => {
        if (!err) return message.react('✅');
        message.react('❌');
        message.reply(err.message);
      });
    });
  }

  async start() {
    const telemetry = new Telemetry(this.start, { parent: this.telemetry });
    const env = EnvironmentFacade.instance();

    this.process = spawn(Utils.joinPaths(...this.executable.path), {
      cwd: Utils.joinPaths(env.cwd, '../../../'),
      detached: true,
    });

    const pid = this.process.pid;
    if (pid) ProcessManager.instance().setOperator(pid, this);

    this.process.stdout?.on('data', data => {
      this.processOutput(data);
    });

    this.process.stderr?.on('data', data => {
      this.processOutput(`\x1b[2;31m[ERR]\x1b[0m ${data}`);
    });

    this.process.once('close', code => {
      if (pid) ProcessManager.instance().deleteOperator(pid);
      this.processOutput(`Exited with code: ${code}`, true);
    });

    telemetry.end();

    return pid;
  }

  kill(signal?: number | NodeJS.Signals) {
    const telemetry = new Telemetry(this.kill, { parent: this.telemetry });

    const pid = this.process?.pid;
    if (!pid) return false;

    telemetry.end();

    return process.kill(-pid, signal);
  }

  private async processOutput(log?: string | Buffer, now?: boolean) {
    const telemetry = new Telemetry(this.processOutput, { parent: this.telemetry });

    if (log instanceof Buffer) log = log.toString();
    if (log) this.outputBuffer.push(log);
    telemetry.log(log);

    if (this.outputBuffer.join('\n').length > 2000) now = true;
    if (!now && this.isSending) return telemetry.end();

    this.isSending = true;
    if (!now) await Utils.sleep(5000);

    const message = [];
    while (this.outputBuffer.length > 0) {
      const data = this.outputBuffer.shift()?.trim();
      if (data?.length) message.push(data);
    }

    if (message.length && this.channel.isSendable()) {
      await this.channel?.send(`\`\`\`ansi\n${message.join('\n')}\`\`\``);
    }

    this.isSending = false;

    telemetry.end();
  }
}
