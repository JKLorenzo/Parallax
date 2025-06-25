import Manager from '../modules/manager.js';
import type { Executable } from '../database/database_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import {
  ActivityType,
  CategoryChannel,
  ChannelType,
  Collection,
  TextChannel,
  type ActivityOptions,
} from 'discord.js';
import { client } from '../main.js';
import { CSConstants } from '../misc/constants.js';
import ProcessInstanceOperator from './operators/process_instance_operator.js';
import Telemetry from '../telemetry/telemetry.js';

export default class ProcessManager extends Manager {
  private static _instance: ProcessManager;

  private executables: Executable[];
  private operators: Collection<number, ProcessInstanceOperator>;

  constructor() {
    super();

    this.executables = [];
    this.operators = new Collection();
  }

  static instance() {
    if (!this._instance) {
      this._instance = new ProcessManager();
    }

    return this._instance;
  }

  async init() {
    const telemetry = new Telemetry(this.init, { parent: this.telemetry });

    await this.updateExecutables();

    setInterval(() => this.updateActivities(), 1000 * 60 * 30);

    telemetry.end();
  }

  getExecutableNames() {
    return this.executables.map(e => e.name);
  }

  getOperatorInfo() {
    return this.operators.map(o => ({ name: o.name, pid: o.pid }));
  }

  async updateExecutables() {
    const telemetry = new Telemetry(this.updateExecutables, { parent: this.telemetry });
    const db = DatabaseFacade.instance();

    this.executables = await db.fetchExecutables();

    telemetry.end();

    return this.executables;
  }

  async start(name: string) {
    const telemetry = new Telemetry(this.start, { parent: this.telemetry });
    const guild = client.guilds.cache.get(CSConstants.GUILD_ID);

    if (this.operators.some(o => o.executable.name === name)) return;

    const executable = this.executables.find(p => p.name === name);
    if (!executable) return;

    const categoryChannel = guild?.channels.cache.get(CSConstants.PROCESSES_CHANNEL_CATEGORY_ID);
    if (!(categoryChannel instanceof CategoryChannel)) return;

    const channelName = name.split(' ')[0].toLowerCase();
    let channel = categoryChannel.children.cache.find(c => c.name === channelName);
    if (!channel) {
      channel = await categoryChannel.children.create({
        name: channelName,
        type: ChannelType.GuildText,
      });
    }
    if (!(channel instanceof TextChannel)) return;

    const operator = new ProcessInstanceOperator(this, executable, channel);
    const pid = await operator.start();

    telemetry.end();

    return pid;
  }

  async setOperator(pid: number, operator: ProcessInstanceOperator) {
    const telemetry = new Telemetry(this.setOperator, { parent: this.telemetry });

    this.operators.set(pid, operator);
    client.addListener('messageCreate', operator.onMessageCreate);

    await this.updateActivities();

    telemetry.end();
  }

  async deleteOperator(pid: number) {
    const telemetry = new Telemetry(this.deleteOperator, { parent: this.telemetry });

    const operator = this.operators.get(pid);
    if (operator) client.removeListener('messageCreate', operator.onMessageCreate);
    if (operator?.pid) this.operators.delete(operator.pid);

    await this.updateActivities();

    telemetry.end();
  }

  async updateActivities() {
    const telemetry = new Telemetry(this.updateActivities, { parent: this.telemetry });

    await client.user?.setPresence({
      activities: this.operators.map(o => {
        const activity: ActivityOptions = {
          name: o.executable.name,
          type: ActivityType.Playing,
        };
        return activity;
      }),
    });

    telemetry.end();
  }

  kill(pid: number, signal?: number | NodeJS.Signals) {
    const telemetry = new Telemetry(this.kill, { parent: this.telemetry });

    const operator = this.operators.get(pid);
    if (!operator) return `Operator not found for pid=${pid}`;

    const killed = operator.kill(signal);

    telemetry.end();

    return `Process \`${pid}\` kill(\`${signal ?? 2}\`) result=\`${killed}\`.`;
  }
}
