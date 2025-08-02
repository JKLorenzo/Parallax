import type { CacheType, ChatInputCommandInteraction, InteractionResponse } from 'discord.js';
import Process from './process.js';
import Telemetry from '../../telemetry/telemetry.js';
import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';

export default abstract class Server {
  protected name: string;
  protected telemetry: Telemetry;
  protected isRunning: boolean;

  protected process?: Process;
  protected gameVersion?: string;

  constructor(name: string, manager: ServerManager) {
    this.name = name;
    this.telemetry = new Telemetry(this.constructor.name, {
      id: name,
      parent: manager.telemetry,
    });
    this.isRunning = false;
  }

  async info() {
    const info: string[] = [];

    const connectionInfo = await this.process?.connectionInfo();
    if (connectionInfo) info.push(connectionInfo);
    if (this.gameVersion) info.push(`Game version: \`${this.gameVersion}\``);

    return info.length > 0 ? info.join('\n') : 'No information available.';
  }

  abstract parseGameVersion(log: string): string | undefined;
  abstract parseReady(log: string): boolean;

  notRunning(interaction: ChatInputCommandInteraction<CacheType>): boolean {
    if (!this.isRunning) {
      interaction.reply(`${this.name} Dedicated Server is not running.`);
      return true;
    }

    return false;
  }

  async start(interaction: ChatInputCommandInteraction<CacheType>) {
    const sm = ServerManager.instance();

    const executable = sm.executables.find(e => e.name === `${this.name} Dedicated Server`);
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
    if (!pid) return await interaction.editReply(`${this.name} failed to start due to an error.`);

    this.process.once('stdlog', async (log, process) => {
      await interaction.editReply(`Starting ${this.name}...`);
      await ServerManager.instance().addActivity(process.executable);
    });

    this.process.once('close', async (code, process) => {
      this.isRunning = false;
      this.process?.removeAllListeners();
      this.process = undefined;
      await ServerManager.instance().removeActivity(process.executable);
    });

    this.process.on('stdlog', async log => {
      const version = this.parseGameVersion(log);
      if (version) this.gameVersion = version;

      if (this.parseReady(log)) {
        this.isRunning = true;
        this.process?.removeAllListeners('stdlog');
        const info = await this.info();
        await interaction.editReply(info);
      }
    });
  }

  async update(interaction: ChatInputCommandInteraction<CacheType>) {
    const sm = ServerManager.instance();

    const executable = sm.executables.find(e => e.name === `${this.name} Update`);
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
    if (!pid) return await interaction.editReply(`${this.name} failed to start due to an error.`);

    this.process.once('stdlog', async (log, process) => {
      await interaction.editReply(`Updating ${this.name}...`);
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
        await interaction.editReply(`${this.name} has been updated successfully.`);
      }
    });
  }

  async kill(interaction: ChatInputCommandInteraction<CacheType>, signal: number) {
    const res = this.process?.kill(signal);
    if (!res) return await interaction.reply(`Process kill failed ${this.name}.`);

    await interaction.reply(`Process killed ${this.name}.`);
  }
}
