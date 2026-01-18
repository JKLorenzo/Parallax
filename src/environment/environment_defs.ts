export const EnvKeys = {
  botToken: 'BOT_TOKEN',
  dbUri: 'DB_URI',
  lavalinkAuth: 'LAVALINK_AUTH',
  lavalinkHost: 'LAVALINK_HOST',
  spotifyId: 'SPOTIFY_ID',
  spotifySecret: 'SPOTIFY_SECRET',
  spotifyRefrresh: 'SPOTIFY_REFRESH',
};

export const BatteryKeys = {
  model: 'Model Name',
  firmware: 'Firmware Number',
  voltageRated: 'Rating Voltage',
  powerRated: 'Rating Power',
  state: 'State',
  source: 'Power Supply by',
  voltageUtility: 'Utility Voltage',
  voltageOutput: 'Output Voltage',
  capacity: 'Battery Capacity',
  remainingRuntime: 'Remaining Runtime',
  powerLoad: 'Load',
  lineInteraction: 'Line Interaction',
  lastEvent: 'Last Power Event',
};

export type BatteryData = {
  properties?: {
    model?: string;
    firmware?: string;
    voltageRated?: string;
    powerRated?: string;
  };
  status?: {
    state?: string;
    source?: string;
    voltageUtility?: string;
    voltageOutput?: string;
    capacity?: string;
    remainingRuntime?: string;
    powerLoad?: string;
    lineInteraction?: string;
    lastEvent?: string;
  };
};
