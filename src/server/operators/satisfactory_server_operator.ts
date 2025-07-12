import type { CacheType, ChatInputCommandInteraction } from 'discord.js';
import Process from '../../modules/process.js';
import Telemetry from '../../telemetry/telemetry.js';
import ServerManager from '../server_manager.js';
import Utils from '../../misc/utils.js';

export default class SatisfactoryServerOperator {
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

    const executable = sm.executables.find(e => e.name === 'Satisfactory Dedicated Server');
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
    if (!pid) return `Satisfactory failed to start due to an error.`;

    this.process.once('stdlog', async (log, process) => {
      await interaction.editReply('Starting Satisfactory Dedicated Server...');
      await ServerManager.instance().addActivity(process.executable);
    });

    this.process.once('close', async (code, process) => {
      this.process?.removeAllListeners();
      this.process = undefined;
      await ServerManager.instance().removeActivity(process.executable);
    });

    this.process.on('stdlog', async log => {
      if (Utils.hasAny(log, 'Set ProjectVersion to')) {
        this.gameVersion = log
          .split(' ')
          .find(l => l.startsWith('++FactoryGame+'))
          ?.replace('++FactoryGame+rel-', '');
      }

      if (Utils.hasAny(log, 'Server startup time elapsed and saving/level loading is done')) {
        this.process?.removeAllListeners('stdlog');
        const info = await this.info();
        await interaction.editReply(info);
      }
    });
  }

  async update(interaction: ChatInputCommandInteraction<CacheType>) {
    const sm = ServerManager.instance();

    const executable = sm.executables.find(e => e.name === 'Satisfactory Update');
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
    if (!pid) return 'Satisfactory failed to update due to an error.';

    this.process.once('stdlog', async (log, process) => {
      await interaction.editReply('Updating Satisfactory...');
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
        await interaction.editReply('Satisfactory has been updated successfully.');
      }
    });
  }
}
