import type { SendableChannels } from 'discord.js';
import type Telemetry from './telemetry.js';

export const TELEMETRY_START_STR = 's()';
export const TELEMETRY_END_STR = 'e()';

export type TelemetryData = {
  channel?: SendableChannels;
  broadcast: boolean;
  identifier: string;
  origin?: string;
  value: unknown;
};

export type TelemetryOptions = {
  id?: string;
  broadcast?: boolean;
  parent?: Telemetry;
  channel?: SendableChannels;
};
