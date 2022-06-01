import {
  DiscordGatewayAdapterCreator,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { ContextMenuInteraction, Guild, GuildMember, Message, TextChannel } from 'discord.js';
import { getSubscription, musicPlay, setSubscription } from '../../managers/music.js';
import { getMusicConfig } from '../../modules/database.js';
import { logError } from '../../modules/telemetry.js';
import Command from '../../structures/command.js';
import Subscription from '../../structures/subscription.js';

export default class PlayMusic extends Command {
  constructor() {
    super(
      {
        name: 'Play Music',
        type: 'MESSAGE',
        defaultPermission: true,
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

  async exec(interaction: ContextMenuInteraction): Promise<unknown> {
    const message = interaction.options.getMessage('message', true) as Message;
    const query = message.content.replaceAll('  ', ' ').trim();
    const guild = interaction.guild as Guild;
    const member = interaction.member as GuildMember;
    const text_channel = interaction.channel as TextChannel;
    const voice_channel = member.voice.channel;
    const current_voice_channel = guild.me?.voice.channel;
    let subscription = getSubscription(guild.id);

    if (message.author.bot) {
      return interaction.reply({
        content: 'Messages sent by bots are not supported.',
        ephemeral: true,
      });
    }

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

    if (subscription && current_voice_channel && current_voice_channel.id !== voice_channel.id) {
      return interaction.reply({
        content: "I'm currently playing on another channel.",
        ephemeral: true,
      });
    }

    if (!guild.me?.permissionsIn(voice_channel).has('VIEW_CHANNEL')) {
      return interaction.reply({
        content: 'I need to have the `View Channel` permission to join your current voice channel.',
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
  }
}
