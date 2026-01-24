import express, { json, type Express, type Request, type Response } from 'express';
import Telemetry from '../../telemetry/telemetry.js';
import HostManager from '../host_manager.js';
import EnvironmentFacade from '../../environment/environment_facade.js';

export default class APIOperator {
  private telemetry: Telemetry;
  private app: Express;

  constructor(manager: HostManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });

    this.app = express().use(json());
  }

  async init() {
    const telemetry = this.telemetry.start(this.init);

    // Register routes
    this.app.post('/ups/powerfailure', (req, res) => this.upsPowerFailure(req, res));
    this.app.post('/ups/lowbattery', (req, res) => this.upsLowBattery(req, res));

    // Start server
    await new Promise(resolve => {
      const API_PORT = EnvironmentFacade.instance().isProduction() ? 5000 : 6000;

      this.app.listen(API_PORT, err => {
        if (err) telemetry.error(err);
        else telemetry.log(`API listening on port ${API_PORT}.`);
        resolve(undefined);
      });
    });

    telemetry.end();
  }

  upsPowerFailure(req: Request, res: Response) {
    const telemetry = this.telemetry.start(this.upsPowerFailure);

    HostManager.instance().ups.onPowerFailure();
    res.sendStatus(200);

    telemetry.end();
  }

  upsLowBattery(req: Request, res: Response) {
    const telemetry = this.telemetry.start(this.upsLowBattery);

    HostManager.instance().ups.onLowBattery();
    res.sendStatus(200);

    telemetry.end();
  }
}
