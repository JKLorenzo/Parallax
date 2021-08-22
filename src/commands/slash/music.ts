import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { CommandInteraction, Guild, GuildMember, Snowflake } from 'discord.js';
import { Track, MusicSubscription } from '../../managers/music.js';
import { getPlaylist, getTrack } from '../../modules/spotify.js';
import { searchYouTube } from '../../modules/youtube.js';
import Command from '../../structures/command.js';
import { hasAny } from '../../utils/functions.js';

const subscriptions = new Map<Snowflake, MusicSubscription>();

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

  async exec(interaction: CommandInteraction): Promise<unknown> {
    const command = interaction.options.getSubcommand();
    const guild = interaction.guild as Guild;
    const member = interaction.member as GuildMember;
    const channel = member.voice.channel;

    let subscription = subscriptions.get(guild.id);

    if (command === 'play') {
      await interaction.deferReply();
      const song = interaction.options.getString('song', true).trim();

      // If a connection to the guild doesn't already exist and the user is in a voice channel, join that channel
      // and create a subscription.
      if (!subscription && channel) {
        subscription = new MusicSubscription(
          joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
          }),
        );
        subscription.voiceConnection.on('error', console.warn);
        subscriptions.set(guild.id, subscription);
      }

      // If there is no subscription, tell the user they need to join a channel.
      if (!subscription) {
        return interaction.followUp('Join a voice channel and then try that again!');
      }

      // Make sure the connection is ready before processing the user's request
      try {
        await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
      } catch (error) {
        console.warn(error);
        return interaction.followUp(
          'Failed to join voice channel within 20 seconds, please try again later!',
        );
      }

      try {
        const enqueue = async (url: string): Promise<Track> => {
          // Attempt to create a Track from the user's video URL
          const track = await Track.from(url, interaction);
          // Enqueue the track and reply a success message to the user
          subscription!.enqueue(track);
          return track;
        };

        if (hasAny(song, 'youtube.com')) {
          const track = await enqueue(song);
          await interaction.followUp(`Enqueued **${track.title}**`);
        } else if (hasAny(song, 'spotify.com/playlist')) {
          const playlist = await getPlaylist(song);
          for (const item of playlist.tracks.items) {
            const data = await searchYouTube(
              `${item.track.name} by ${item.track.artists.map(a => a.name).join(' ')}`,
            );
            if (data) enqueue(data.link);
          }
          await interaction.followUp(
            `Enqueued ${playlist.tracks.items.length} songs from ` +
              `**${playlist.name}** playlist by ${playlist.owner.display_name}`,
          );
        } else if (hasAny(song, 'spotify.com/track')) {
          const spotifyTrack = await getTrack(song);
          const data = await searchYouTube(
            `${spotifyTrack.name} by ${spotifyTrack.artists.map(a => a.name).join(' ')}`,
          );
          if (data) {
            const track = await enqueue(data.link);
            await interaction.followUp(`Enqueued **${track.title}**`);
          } else {
            await interaction.editReply('Failed to play track, please try again later!');
          }
        }
      } catch (error) {
        console.warn(error);
        await interaction.editReply('Failed to play track, please try again later!');
      }
    } else if (command === 'skip') {
      if (subscription) {
        // Calling .stop() on an AudioPlayer causes it to transition into the Idle state. Because of a state transition
        // listener defined in music/subscription.ts, transitions into the Idle state mean the next track from the queue
        // will be loaded and played.
        subscription.audioPlayer.stop();
        await interaction.reply('Skipped song!');
      } else {
        await interaction.reply('Not playing in this server!');
      }
    } else if (command === 'queue') {
      // Print out the current queue, including up to the next 5 tracks to be played.
      if (subscription) {
        const current =
          subscription.audioPlayer.state.status === AudioPlayerStatus.Idle
            ? `Nothing is currently playing!`
            : `Playing **${
                (subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title
              }**`;

        const queue = subscription.queue
          .slice(0, 5)
          .map((track, index) => `${index + 1}) ${track.title}`)
          .join('\n');

        await interaction.reply(`${current}\n\n${queue}`);
      } else {
        await interaction.reply('Not playing in this server!');
      }
    } else if (command === 'pause') {
      if (subscription) {
        subscription.audioPlayer.pause();
        await interaction.reply('Paused!');
      } else {
        await interaction.reply('Not playing in this server!');
      }
    } else if (interaction.commandName === 'resume') {
      if (subscription) {
        subscription.audioPlayer.unpause();
        await interaction.reply('Unpaused!');
      } else {
        await interaction.reply('Not playing in this server!');
      }
    } else if (interaction.commandName === 'leave') {
      if (subscription) {
        subscription.voiceConnection.destroy();
        subscriptions.delete(guild.id);
        await interaction.reply('Left channel!');
      } else {
        await interaction.reply('Not playing in this server!');
      }
    }
  }
}
