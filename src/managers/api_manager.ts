import { join, relative } from 'path';
import { pathToFileURL } from 'url';
import express, {
  json,
  urlencoded,
  Express,
  Router,
  Request,
  Response,
  NextFunction,
} from 'express';
import type Bot from '../modules/bot.js';
import { APIMethod } from '../schemas/enums.js';
import type APIRoute from '../structures/api_route.js';
import Manager from '../structures/manager.js';

export default class APIManager extends Manager {
  private expressClient: Express;

  constructor(bot: Bot) {
    super(bot);

    this.expressClient = express()
      .use(json())
      .use(urlencoded({ extended: false }));
  }

  async init() {
    const initTelemetry = this.bot.managers.telemetry.node(this, 'Initialize');

    try {
      const router = Router();
      const routesPath = join(process.cwd(), 'build/routes');
      const staticPath = join(process.cwd(), 'web/build/web');

      for (const routePath of this.bot.utils.getFiles(routesPath)) {
        if (!routePath.endsWith('.js')) continue;

        const filePath = pathToFileURL(routePath).href;
        const relPath = relative(routesPath, routePath);
        const sections = relPath.replace(/\\/g, '/').split('/');
        const endpoint = `/api/${sections
          .slice(0, sections.length - 1)
          .map(section => {
            if (!section.startsWith('_')) return section;
            return `:${section.substring(1)}`;
          })
          .join('/')}`;

        const { default: Route } = await import(filePath);
        const route = new Route(this.bot) as APIRoute;
        const method = sections[sections.length - 1].split('.')[0].toUpperCase() as APIMethod;

        const middleware = (req: Request, res: Response, next: NextFunction) =>
          route.middleware(req, res, next);
        const exec = (req: Request, res: Response) => route.exec(req, res);

        switch (method) {
          case APIMethod.Get:
            router.get(endpoint, middleware, exec);
            break;
          case APIMethod.Put:
            router.put(endpoint, middleware, exec);
            break;
          case APIMethod.Patch:
            router.patch(endpoint, middleware, exec);
            break;
          case APIMethod.Delete:
            router.delete(endpoint, middleware, exec);
            break;
          default:
            throw new Error(`HTTP ${method} method is not supported. At ${endpoint}.`);
        }
      }

      this.expressClient
        .use(router)
        .use(express.static(staticPath))
        .listen(process.env.PORT ?? 3000);

      initTelemetry.logMessage(`A total of ${router.length} routes were loaded`, false);
    } catch (error) {
      initTelemetry.logError(error);
    }
  }
}
