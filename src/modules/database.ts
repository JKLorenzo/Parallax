import mongodb from 'mongodb';

const mongoClient = new mongodb.MongoClient(process.env.DB_URI!, {
  keepAlive: true,
});

export async function connect(): Promise<void> {
  await mongoClient.connect();
}

export async function getGuildConfig(guildId: string, key: string): Promise<unknown> {
  const guild_config = await mongoClient.db(guildId).collection('config').findOne({ _id: key });
  return guild_config;
}

export async function setGuildConfig(guildId: string, key: string, value: unknown): Promise<void> {
  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: key }, { $set: value }, { upsert: true });
}
