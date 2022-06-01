import {
  DiscordGatewayAdapterCreator,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { CommandInteraction, Guild, GuildMember, TextChannel } from 'discord.js';
import {
  musicPlay,
  musicSkip,
  musicStop,
  musicQueue,
  musicPause,
  musicResume,
  musicLeave,
  getSubscription,
  setSubscription,
} from '../../managers/music.js';
import { getMusicConfig } from '../../modules/database.js';
import { logError } from '../../modules/telemetry.js';
import Command from '../../structures/command.js';
import Subscription from '../../structures/subscription.js';

export default class Music extends Command {
  constructor() {
    super(
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
                name: 'query',
                type: 'STRING',
                description: 'The name of the song or its URL (YouTube, SoundCloud, Spotify).',
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
        scope: 'guild',
        guilds: async guild => {
          const config = await getMusicConfig(guild.id);
          if (config?.enabled) return true;
          return false;
        },
      },
    );
  }

  async exec(interaction: CommandInteraction): Promise<unknown> {
    const config = await getMusicConfig(interaction.guildId!);

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

    switch (interaction.options.getSubcommand()) {
      case 'play': {
        const query = interaction.options.getString('query', true).replaceAll('  ', ' ').trim();
        const guild = interaction.guild as Guild;
        const member = interaction.member as GuildMember;
        const text_channel = interaction.channel as TextChannel;
        const voice_channel = member.voice.channel;
        const current_voice_channel = guild.me?.voice.channel;
        let subscription = getSubscription(guild.id);

        if (query.length === 0) {
          return interaction.reply({
            content: 'Search query is empty.',
            ephemeral: true,
          });
        }

        if (!voice_channel) {
          return interaction.reply({
            content: 'Join a voice channel and then try that again.',
            ephemeral: true,
          });
        }

        if (
          subscription &&
          current_voice_channel &&
          current_voice_channel.id !== voice_channel.id
        ) {
          return interaction.reply({
            content: "I'm currently playing on another channel.",
            ephemeral: true,
          });
        }

        if (!guild.me?.permissionsIn(voice_channel).has('VIEW_CHANNEL')) {
          return interaction.reply({
            content:
              'I need to have the `View Channel` permission to join your current voice channel.',
            ephemeral: true,
          });
        }

        if (!guild.me?.permissionsIn(voice_channel).has('CONNECT')) {
          return interaction.reply({
            content: 'I need to have the `Connect` permission to join your current voice channel.',
            ephemeral: true,
          });
        }

        if (!guild.me?.permissionsIn(voice_channel).has('SPEAK')) {
          return interaction.reply({
            content: 'I need to have the `Speak` permission to use this command.',
            ephemeral: true,
          });
        }

        if (!guild.me?.permissionsIn(voice_channel).has('USE_VAD')) {
          return interaction.reply({
            content: 'I need to have the `Use Voice Activity` permission to use this command.',
            ephemeral: true,
          });
        }

        if (voice_channel.full && !voice_channel.joinable) {
          return interaction.reply({
            content: 'Your current voice channel has a user limit and is already full.',
            ephemeral: true,
          });
        }

        await interaction.deferReply();

        if (!subscription || !current_voice_channel) {
          subscription = new Subscription(
            joinVoiceChannel({
              channelId: voice_channel.id,
              guildId: guild.id,
              adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
            }),
          );
          subscription.voiceConnection.on('error', error => {
            logError('Music Manager', 'Voice Connection', error);
          });
          setSubscription(guild.id, subscription);
        }

        try {
          await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
        } catch (_) {
          return interaction.editReply('Failed to join voice channel within 20 seconds.');
        }

        const result = await musicPlay(query, text_channel, subscription);

        await interaction.editReply(result);
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
