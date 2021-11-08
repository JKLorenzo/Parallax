import { CommandInteraction, Guild } from 'discord.js';
import {
  musicPlay,
  musicSkip,
  musicStop,
  musicQueue,
  musicPause,
  musicResume,
  musicLeave,
} from '../../managers/music.js';
import { getMusicConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';

export default class Music extends Command {
  constructor() {
    super(
      'guild',
      {
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
            options: [
              {
                name: 'count',
                type: 'INTEGER',
                description: 'The number of songs to skip. Defaults to 1.',
                required: false,
              },
            ],
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
      },
      {
        guilds: async guild => {
          const config = await getMusicConfig(guild.id);
          if (!config || !config.enabled) return false;
          return true;
        },
      },
    );
  }

  async exec(interaction: CommandInteraction): Promise<void> {
    const config = await getMusicConfig(interaction.guildId);

    if (!config) {
      return interaction.reply({
        content: 'Music configuration is not set.',
        ephemeral: true,
      });
    }

    if (!config.enabled) {
      return interaction.reply({
        content: 'Music commands are disabled.',
        ephemeral: true,
      });
    }

    if (config.channel && config.channel !== interaction.channelId) {
      const guild = interaction.guild as Guild;
      const channel = guild.channels.cache.get(interaction.channelId);

      if (!channel) {
        return interaction.reply({
          content:
            'Channel property of music configuration is invalid. Please update your music configuration.',
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `Music commands can only be used on ${channel} channel.`,
        ephemeral: true,
      });
    }

    switch (interaction.options.getSubcommand()) {
      case 'play': {
        await musicPlay(interaction);
        break;
      }
      case 'skip': {
        const count = interaction.options.getInteger('count', false);
        if (typeof count === 'number' && count < 1) {
          return interaction.reply({
            content: 'You must provide a number that is greater than or equal to 1.',
            ephemeral: true,
          });
        }
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
