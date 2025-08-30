import { ActivityType, Collection, type ActivityOptions } from 'discord.js';
import {
  upnpNat,
  type Gateway,
  type PortMapping,
  type UPnPNAT,
} from '@achingbrain/nat-port-mapper';
import ip from 'ip';
import type { Executable, Port } from '../database/database_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import { client } from '../main.js';
import Manager from '../modules/manager.js';
import Telemetry from '../telemetry/telemetry.js';
import PalworldServer from './servers/palworld_server.js';
import SatisfactoryServer from './servers/satisfactory_server.js';
import AbioticFactorServer from './servers/abiotic_server.js';
import RustServer from './servers/rust_server.js';
import type Server from './modules/server.js';

export default class ServerManager extends Manager {
  private static _instance: ServerManager;
  private _executables: Executable[];

  private upnp: UPnPNAT;
  private upnp_clients: Collection<string, { mapping: PortMapping; gateway: Gateway }[]>;
  private activities: string[];
  private activityInterval?: NodeJS.Timeout;

  private _abiotic?: AbioticFactorServer;
  private _palworld?: PalworldServer;
  private _rust?: RustServer;
  private _satisfactory?: SatisfactoryServer;

  constructor() {
    super();

    this._executables = [];
    this.activities = [];

    this.upnp = upnpNat({
      ttl: 600_000,
      autoRefresh: true,
      refreshThreshold: 300_000
    });
    this.upnp_clients = new Collection();
  }

  static instance() {
    if (!this._instance) {
      this._instance = new ServerManager();
    }

    return this._instance;
  }

  get executables() {
    return this._executables;
  }

  get abiotic() {
    if (!this._abiotic) this._abiotic = new AbioticFactorServer(this);
    return this._abiotic;
  }

  get palworld() {
    if (!this._palworld) this._palworld = new PalworldServer(this);
    return this._palworld;
  }

  get rust() {
    if (!this._rust) this._rust = new RustServer(this);
    return this._rust;
  }

  get satisfactory() {
    if (!this._satisfactory) this._satisfactory = new SatisfactoryServer(this);
    return this._satisfactory;
  }

  async init() {
    const telemetry = new Telemetry(this.init, { parent: this.telemetry });

    await this.updateExecutables();

    telemetry.end();
  }

  async mapPorts(server: Server, ports: Port[]) {
    const telemetry = new Telemetry(this.mapPorts, { parent: this.telemetry });

    const upnp_ports = this.upnp_clients.get(server.name) ?? [];
    for await (const gateway of this.upnp.findGateways({ signal: AbortSignal.timeout(10000) })) {
      for (const port of ports) {
        const mapping = await gateway.map(port.port, ip.address(), {
          protocol: port.protocol,
          description: server.name,
        });

        upnp_ports.push({ mapping, gateway });

        telemetry.log(
          [
            `Mapped ${mapping.protocol}`,
            `${mapping.internalHost}:${mapping.internalPort}`,
            'to',
            `${mapping.externalHost}:${mapping.externalPort}`,
            'on',
            `${gateway.host}`,
          ].join(' '),
        );
      }

      break;
    }

    this.upnp_clients.set(server.name, upnp_ports);

    telemetry.end();
  }

  async unmapPorts(server: Server) {
    const telemetry = new Telemetry(this.unmapPorts, { parent: this.telemetry });

    for (const upnp_port of this.upnp_clients.get(server.name) ?? []) {
      await upnp_port.gateway.unmap(upnp_port.mapping.internalPort);

      telemetry.log(
        [
          `Unmapped ${upnp_port.mapping.protocol}`,
          `${upnp_port.mapping.internalHost}:${upnp_port.mapping.internalPort}`,
          'from',
          `${upnp_port.mapping.externalHost}:${upnp_port.mapping.externalPort}`,
          'on',
          `${upnp_port.gateway.host}`,
        ].join(' '),
      );
    }

    this.upnp_clients.delete(server.name);

    telemetry.end();
  }

  async updateExecutables() {
    const telemetry = new Telemetry(this.updateExecutables, { parent: this.telemetry });
    const db = DatabaseFacade.instance();

    this._executables = await db.fetchExecutables();

    telemetry.end();

    return this.executables;
  }

  async addActivity(executable: Executable) {
    if (this.activities.some(a => a === executable.name)) return;

    this.activities.push(executable.name);
    await this.updateActivities();
  }

  async removeActivity(executable: Executable) {
    if (!this.activities.some(a => a === executable.name)) return;

    this.activities = this.activities.filter(a => a !== executable.name);
    await this.updateActivities();
  }

  private async updateActivities() {
    const telemetry = new Telemetry(this.updateActivities, { parent: this.telemetry });

    await client.user?.setPresence({
      activities: this.activities.map(name => {
        const activity: ActivityOptions = {
          name: name,
          type: ActivityType.Playing,
        };
        return activity;
      }),
    });

    if (this.activities.length > 0) {
      this.activityInterval ??= setInterval(() => this.updateActivities(), 1000 * 60 * 30);
    } else if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }

    telemetry.end();
  }
}
