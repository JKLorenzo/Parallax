import { writeFile } from 'fs/promises';
import { AudioResource, createAudioResource } from '@discordjs/voice';
import googleTTS from 'node-google-tts-api';

const gtts = new googleTTS();

export async function synthesize(content: string): Promise<AudioResource> {
  const file_name = `${Math.round(content.length * Math.random() + 1)}.mp3`;

  const data = await gtts.get({
    text: content,
    lang: 'en',
    limit_bypass: true,
  });

  await writeFile(file_name, data);

  return createAudioResource(file_name);
}
