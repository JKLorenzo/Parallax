import { CommandInteraction } from 'discord.js';
import {
  musicPlay,
  musicSkip,
  musicStop,
  musicQueue,
  musicPause,
  musicResume,
  musicLeave,
} from '../../managers/music.js';
import Command from '../../structures/command.js';

export default class Music extends Command {
  constructor() {
    super('guild', {
      name: 'music',
      description: 'Contains all the music commands of this bot.',
      type: 'CHAT_INPUT',
      defaultPermission: true,
      options: [
        {
          name: 'play',
          description: 'Plays a song on your current voice channel',
          type: 'SUB_COMMAND',
          options: [
            {
              name: 'song',
              type: 'STRING',
              description: 'The name of the song or its URL',
              required: true,
            },
          ],
        },
        {
          name: 'skip',
          description: 'Skip to the next song in the queue',
          type: 'SUB_COMMAND',
        },
        {
          name: 'stop',
          description: 'Stops playing and clears the queue',
          type: 'SUB_COMMAND',
        },
        {
          name: 'queue',
          description: 'See the music queue',
          type: 'SUB_COMMAND',
        },
        {
          name: 'pause',
          description: 'Pauses the song that is currently playing',
          type: 'SUB_COMMAND',
        },
        {
          name: 'resume',
          description: 'Resume playback of the current song',
          type: 'SUB_COMMAND',
        },
        {
          name: 'leave',
          description: 'Leave the voice channel',
          type: 'SUB_COMMAND',
        },
      ],
    });
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const command = interaction.options.getSubcommand();

    switch (command) {
      case 'play': {
        await musicPlay(interaction);
        break;
      }
      case 'skip': {
        await musicSkip(interaction);
        break;
      }
      case 'stop': {
        await musicStop(interaction);
        break;
      }
      case 'queue': {
        await musicQueue(interaction);
        break;
      }
      case 'pause': {
        await musicPause(interaction);
        break;
      }
      case 'resume': {
        await musicResume(interaction);
        break;
      }
      case 'leave': {
        await musicLeave(interaction);
        break;
      }
    }
  }
}
