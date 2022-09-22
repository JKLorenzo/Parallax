import type { Request, Response } from 'express';
import APIRoute from '../../structures/api_route.js';

export default class GetPing extends APIRoute {
  exec(req: Request, res: Response): void {
    res.send({ ping: this.bot.client.ws.ping });
  }
}
