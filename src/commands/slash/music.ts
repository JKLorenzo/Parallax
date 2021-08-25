import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { CommandInteraction, Guild, GuildMember, Snowflake, TextChannel } from 'discord.js';
import ytdl_core from 'ytdl-core';
import { Track, MusicSubscription } from '../../managers/music.js';
import { getPlaylist, getTrack } from '../../modules/spotify.js';
import { searchYouTube } from '../../modules/youtube.js';
import Command from '../../structures/command.js';
import { hasAny } from '../../utils/functions.js';
const { getInfo } = ytdl_core;

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
        return interaction.followUp('Join a voice channel and then try that again.');
      }

      // Make sure the connection is ready before processing the user's request
      try {
        await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
      } catch (error) {
        console.warn(error);
        return interaction.followUp(
          'Failed to join voice channel within 20 seconds, please try again later.',
        );
      }

      try {
        const enqueue = (query: string, title?: string, image?: string): Track =>
          subscription!.enqueue(interaction.channel as TextChannel, query, title, image);

        if (hasAny(song, 'http')) {
          if (hasAny(song, 'youtube.com')) {
            const info = await getInfo(song);
            if (!info) return interaction.editReply('No match found, please try again.');
            await enqueue(song, info.videoDetails.title, info.thumbnail_url);
            await interaction.followUp(`Enqueued **${info.videoDetails.title}**`);
          } else if (hasAny(song, 'spotify.com/playlist')) {
            const playlist = await getPlaylist(song);
            for (const item of playlist.tracks.items) {
              await enqueue(
                `${item.track.name} by ${item.track.artists.map(a => a.name).join(' ')}`,
                `${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`,
                item.track.album.images[0]?.url,
              );
            }
            await interaction.followUp(
              `Enqueued ${playlist.tracks.items.length} songs from ` +
                `**${playlist.name}** playlist by **${playlist.owner.display_name}**.`,
            );
          } else if (hasAny(song, 'spotify.com/track')) {
            const track = await getTrack(song);
            const data = await searchYouTube(
              `${track.name} by ${track.artists.map(a => a.name).join(' ')}`,
            );
            if (!data) return interaction.editReply('No match found, please try again.');
            await enqueue(
              data.link,
              `${track.name} - ${track.artists.map(a => a.name).join(', ')}`,
              data.thumbnails.default?.url,
            );
            await interaction.followUp(`Enqueued **${data.title}**`);
          }
        } else {
          const data = await searchYouTube(song);
          if (!data) return interaction.editReply('No match found, please try again.');
          await enqueue(data.link, data.title, data.thumbnails.default?.url);
          await interaction.followUp(`Enqueued **${data.title}**`);
        }
      } catch (error) {
        console.warn(error);
        await interaction.editReply('Failed to play track, please try again later.');
      }
    } else if (command === 'skip') {
      if (subscription) {
        // Calling .stop() on an AudioPlayer causes it to transition into the Idle state. Because of a state transition
        // listener defined in music/subscription.ts, transitions into the Idle state mean the next track from the queue
        // will be loaded and played.
        subscription.audioPlayer.stop();
        await interaction.reply('Skipped song.');
      } else {
        await interaction.reply('Not playing in this server.');
      }
    } else if (command === 'stop') {
      if (subscription) {
        subscription.stop();
        await interaction.reply('Stopped all songs.');
      } else {
        await interaction.reply('Not playing in this server.');
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
        await interaction.reply('Not playing in this server.');
      }
    } else if (command === 'pause') {
      if (subscription) {
        subscription.audioPlayer.pause();
        await interaction.reply('Paused.');
      } else {
        await interaction.reply('Not playing in this server.');
      }
    } else if (command === 'resume') {
      if (subscription) {
        subscription.audioPlayer.unpause();
        await interaction.reply('Unpaused.');
      } else {
        await interaction.reply('Not playing in this server.');
      }
    } else if (command === 'leave') {
      if (subscription) {
        subscription.voiceConnection.destroy();
        subscriptions.delete(guild.id);
        await interaction.reply('Left channel.');
      } else {
        await interaction.reply('Not playing in this server.');
      }
    }
  }
}
