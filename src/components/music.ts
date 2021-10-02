import { AudioPlayerStatus } from '@discordjs/voice';
import { Guild, GuildMember, MessageComponentInteraction, MessageEmbed } from 'discord.js';
import { client } from '../main.js';
import {
  getSubscription,
  musicPause,
  musicResume,
  musicSkip,
  musicStop,
  musicQueue,
  musicLeave,
} from '../managers/music.js';
import Component from '../structures/component.js';

export default class Music extends Component {
  constructor() {
    super({
      name: 'music',
      options: [
        {
          type: 'ACTION_ROW',
          components: [
            {
              customId: 'region',
              type: 'SELECT_MENU',
              placeholder: 'Update the RTC Region of your Channel',
              minValues: 1,
              maxValues: 1,
              options: [
                {
                  label: 'Automatic',
                  value: 'automatic',
                  emoji: client.emojis.cache.find(e => e.name === 'discord'),
                  description: 'Let Discord decide automatically',
                },
                {
                  label: 'SG - Singapore',
                  value: 'singapore',
                  emoji: client.emojis.cache.find(e => e.name === 'singapore'),
                },
                {
                  label: 'HK - Hong Kong',
                  value: 'hongkong',
                  emoji: client.emojis.cache.find(e => e.name === 'hongkong'),
                },
                {
                  label: 'JP - Japan',
                  value: 'japan',
                  emoji: client.emojis.cache.find(e => e.name === 'japan'),
                },
              ],
            },
          ],
        },
        {
          type: 'ACTION_ROW',
          components: [
            {
              customId: 'pauseplay',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'pauseplay'),
            },
            {
              customId: 'skip',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'skip'),
            },
            {
              customId: 'stop',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'stop'),
            },
            {
              customId: 'queue',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'queue'),
            },
            {
              customId: 'leave',
              type: 'BUTTON',
              label: 'Disconnect',
              style: 'DANGER',
              emoji: client.emojis.cache.find(e => e.name === 'power'),
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: MessageComponentInteraction, customId: string): Promise<void> {
    if (interaction.isButton()) {
      switch (customId) {
        case 'pauseplay': {
          const guild = interaction.guild as Guild;
          const subscription = getSubscription(guild.id);

          if (subscription) {
            switch (subscription.audioPlayer.state.status) {
              case AudioPlayerStatus.Paused: {
                await musicResume(interaction);
                break;
              }
              case AudioPlayerStatus.Playing: {
                await musicPause(interaction);
                break;
              }
            }
          }
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
        case 'leave': {
          await musicLeave(interaction);
          break;
        }
      }
    } else if (interaction.isSelectMenu()) {
      switch (customId) {
        case 'region': {
          const value = interaction.values[0];
          const region = value === 'automatic' ? null : value;

          const guild = interaction.guild as Guild;
          const member = interaction.member as GuildMember;
          const channel = member.voice.channel;
          const current_voice_channel = guild.me?.voice.channel;

          if (!current_voice_channel) {
            return interaction.reply({
              content: "I'm currently not connected to any voice channel.",
              ephemeral: true,
            });
          }

          if (current_voice_channel.id !== channel?.id) {
            return interaction.reply({
              content:
                "You must be on the same channel where I'm currently active to perform this action.",
              ephemeral: true,
            });
          }

          if (region !== current_voice_channel.rtcRegion) {
            await current_voice_channel.setRTCRegion(region);

            const embed = interaction.message.embeds[0] as MessageEmbed;
            await interaction.update({
              embeds: [
                embed.setFooter(
                  `Channel: ${current_voice_channel?.name ?? 'Unknown'}  |  Region: ${
                    current_voice_channel?.rtcRegion
                      ?.split(' ')
                      .map(s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`) ?? 'Automatic'
                  }  |  Bitrate: ${
                    current_voice_channel
                      ? `${current_voice_channel.bitrate / 1000}kbps`
                      : 'Unknown'
                  }`,
                ),
              ],
            });
          } else {
            await interaction.deferUpdate();
          }
          break;
        }
      }
    }
  }
}
