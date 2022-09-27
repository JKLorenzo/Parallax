import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  CacheType,
  ChatInputCommandInteraction,
} from 'discord.js';
import type Bot from '../../../modules/bot.js';
import { CommandScope } from '../../../schemas/enums.js';
import SlashCommand from '../../../structures/command_slash.js';

export default class MusicSlashCommand extends SlashCommand {
  constructor(bot: Bot) {
    super(
      bot,
      {
        name: 'music',
        description: 'Contains all the music commands of this bot.',
        type: ApplicationCommandType.ChatInput,
        options: [
          {
            name: 'play',
            description: 'Plays a song on your current voice channel or adds it to the queue.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'query',
                type: ApplicationCommandOptionType.String,
                description:
                  'The name of the song or its URL (YouTube, SoundCloud, Spotify, Deezer).',
                required: true,
              },
            ],
          },
          {
            name: 'skip',
            description:
              'Skips to the next song in the queue or to the selected position, if supplied.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'position',
                type: ApplicationCommandOptionType.Integer,
                description: 'The position to skip to. Defaults to the next queued track (1).',
                required: false,
              },
            ],
          },
          {
            name: 'stop',
            description: 'Stops the music player and clears the queue.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'list',
            description:
              'Shows the title of the current song and the first 5 queued songs, if any.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'pause',
            description: 'Pauses the song that is currently playing',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'resume',
            description: 'Resume playback of the current song.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'pauseplay',
            description: 'Either pause or play the music player depending on its current state.',
            type: ApplicationCommandOptionType.Subcommand,
          },
          {
            name: 'disconnect',
            description: 'Disconnects the bot and clears the queue.',
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
      {
        scope: CommandScope.Global,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const { music } = this.bot.managers;
    const user = interaction.user;
    const command = interaction.options.getSubcommand(true);
    let textChannel = interaction.channel;

    await interaction.deferReply();

    let result;

    switch (command) {
      case 'play': {
        const query = interaction.options.getString('query', true).replaceAll('  ', ' ').trim();

        if (!textChannel || textChannel.isDMBased()) {
          textChannel = await user.createDM();
        }

        result = await music.play({ user, textChannel, query });
        break;
      }
      case 'skip': {
        const position = interaction.options.getInteger('position', false);

        result = music.skip({ user, textChannel, skipCount: position });
        break;
      }
      case 'stop': {
        result = music.stop({ user, textChannel });
        break;
      }
      case 'list': {
        result = music.list({ user, textChannel });
        break;
      }
      case 'pause': {
        result = music.pause({ user, textChannel });
        break;
      }
      case 'resume': {
        result = music.resume({ user, textChannel });
        break;
      }
      case 'pauseplay': {
        result = music.pauseplay({ user, textChannel });
        break;
      }
      case 'disconnect': {
        result = await music.disconnect({ user, textChannel });
        break;
      }
      default: {
        result = `Unknown command \`${command}\`.`;
      }
    }

    await interaction.editReply(result);
  }
}
