import type { Request, Response, NextFunction } from 'express';
import type Bot from '../modules/bot.js';

export default abstract class APIRoute {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  // Accept request (default)
  middleware(req: Request, res: Response, next: NextFunction) {
    next();
  }

  // Not Found (default)
  exec(req: Request, res: Response) {
    res.sendStatus(404);
  }
}
