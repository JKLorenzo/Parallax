import {
  AudioPlayerStatus,
  AudioResource,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import {
  Collection,
  Colors,
  EmbedBuilder,
  GuildChannel,
  Message,
  type BaseMessageOptions,
  PermissionFlagsBits,
  type TextBasedChannel,
  User,
  type VoiceBasedChannel,
  VoiceState,
} from 'discord.js';
import playdl from 'play-dl';
import type { QueryLookupResult, QueryOptions } from './music_defs.js';
import MusicHandlerFactory from './music_handler_factory.js';
import MusicSubscription from './music_subscription.js';
import type MusicTrack from './music_track.js';
import type Bot from '../../modules/bot.js';
import Constants from '../../modules/constants.js';
import Queuer from '../../modules/queuer.js';
import Manager from '../../structures/manager.js';

export default class MusicManager extends Manager {
  disabled: boolean;
  subscriptions: Collection<string, MusicSubscription>;
  commandQueuer: Queuer;

  constructor(bot: Bot) {
    super(bot);

    this.disabled = false;
    this.subscriptions = new Collection();
    this.commandQueuer = new Queuer();
  }

  async init() {
    const { environment } = this.bot.managers;

    await playdl.setToken({
      soundcloud: {
        client_id: environment.get('soundcloudId'),
      },
      spotify: {
        market: 'PH',
        client_id: environment.get('spotifyId'),
        client_secret: environment.get('spotifySecret'),
        refresh_token: environment.get('spotifyRefresh'),
      },
      useragent: [environment.get('userAgent')],
    });

    this.bot.client.on('voiceStateUpdate', (oldState, newState) => {
      this.onVoiceStateUpdate(oldState, newState);
    });

    this.bot.client.on('messageCreate', message => {
      this.onMessageCreate(message);
    });
  }

  private onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const guildId = newState.guild.id;
    const subscription = this.subscriptions.get(guildId);
    subscription?.onVoiceStateUpdate(oldState, newState);
  }

  private async onMessageCreate(message: Message<boolean>) {
    const { database } = this.bot.managers;

    if (message.author.bot) return;

    const guild = message.guild;
    if (!guild) return;

    const config = await database.musicConfig(guild.id);
    if (!config?.enabled || message.channelId !== config.channel) return;

    const query = message.content;
    const textChannel = message.channel;

    // Check if message is a command for other bots
    const response = await Promise.race([
      textChannel.awaitMessages({
        filter: msg => msg.author.id !== this.bot.client.user?.id,
        max: 1,
        time: 2000,
      }),
      message.awaitReactions({
        filter: reac => reac.users.cache.some(u => u.bot),
        max: 1,
        time: 2000,
      }),
    ]);
    if (response.first()) return;

    const user = message.member?.user;
    if (!user) return;

    const result = await this.play({ user, textChannel, query });

    await message.reply(result);
  }

  private async queryLookup(queryOptions: QueryOptions): Promise<QueryLookupResult> {
    const embed = new EmbedBuilder({
      description: Constants.MUSIC_QUERY_NO_RESULT,
      color: Colors.Fuchsia,
    });

    if (playdl.is_expired()) {
      const tokenTelemetry = this.bot.managers.telemetry.node(this, 'PlayDL Token Refresh');
      try {
        await playdl.refreshToken();
        tokenTelemetry.logMessage('Token refreshed successfully.');
      } catch (error) {
        tokenTelemetry.logError(error);
      }
    }

    const handler = await MusicHandlerFactory.createHandler(queryOptions);
    const info = await handler?.fetchInfo();
    if (info) embed.setColor(Colors.Aqua).setDescription(`Enqueued ${info.toFormattedString()}.`);

    return { message: { embeds: [embed] }, handler: handler };
  }

  private checkChannel(voiceChannel?: VoiceBasedChannel | null): BaseMessageOptions | undefined {
    const messages = [];

    if (!voiceChannel) {
      messages.push(Constants.VOICE_CHANNEL_JOIN);
    } else {
      const me = voiceChannel?.guild.members.me;
      const subscription = this.subscriptions.get(voiceChannel.guild.id);

      if (subscription && subscription.voiceChannel?.id !== voiceChannel.id) {
        messages.push(Constants.VOICE_CHANNEL_DIFF);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.ViewChannel)) {
        messages.push(Constants.NO_PERM_VIEW_CHANNEL);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.Connect)) {
        messages.push(Constants.NO_PERM_CONNECT);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.Speak)) {
        messages.push(Constants.NO_PERM_SPEAK);
      }

      if (!me?.permissionsIn(voiceChannel).has(PermissionFlagsBits.UseVAD)) {
        messages.push(Constants.NO_PERM_VAD);
      }

      if (voiceChannel.full && !voiceChannel.joinable) {
        messages.push(Constants.VOICE_CHANNEL_FULL);
      }
    }

    if (messages.length === 0) return;

    const embed = new EmbedBuilder({
      description: messages.map(m => `🔸${m}`).join('\n'),
      color: Colors.Fuchsia,
    });

    return { embeds: [embed] };
  }

  play(options: {
    user: User;
    textChannel: TextBasedChannel;
    query?: string;
  }): Promise<BaseMessageOptions> {
    return this.commandQueuer.queue(async () => {
      if (this.disabled) {
        return { embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_DISABLED }] };
      }

      if (!options.query?.length) {
        return { embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_QUERY_EMPTY }] };
      }

      const guild =
        options.textChannel instanceof GuildChannel
          ? options.textChannel.guild
          : this.bot.client.guilds.cache.find(
              g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
            );
      const member = guild?.members.resolve(options.user);
      const voiceChannel = member?.voice.channel;
      const checkResult = this.checkChannel(voiceChannel);

      if (!guild || !member || !voiceChannel || checkResult) {
        return (
          checkResult ?? {
            embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
          }
        );
      }

      let subscription = this.subscriptions.get(guild.id);

      if (!subscription) {
        subscription = new MusicSubscription({ bot: this.bot, voiceChannel });

        // Join voice channel
        try {
          await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20000);
        } catch (_) {
          return {
            embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_JOIN_CHANNEL_FAILED }],
          };
        }

        // Update subscriptions
        this.subscriptions.set(guild.id, subscription);
      }

      const lookupResult = await this.queryLookup({
        subscription,
        channel: options.textChannel,
        requestedBy: options.user,
        query: options.query,
      });

      if (lookupResult.handler) subscription.queue(lookupResult.handler);
      return lookupResult.message;
    });
  }

  skip(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
    skipCount?: number | null;
  }): BaseMessageOptions {
    if (typeof options.skipCount === 'number' && options.skipCount <= 0) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_SKIPCOUNT_INVALID }],
      };
    }

    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const skippedTracks = subscription.stop({ skipCount: options.skipCount ?? 1 });

    return {
      embeds: [
        {
          color: Colors.Aqua,
          description: `${member.toString()} skipped ${skippedTracks} track${
            skippedTracks > 1 ? 's' : ''
          } from the queue.`,
        },
      ],
    };
  }

  stop(options: { user: User; textChannel?: TextBasedChannel | null }): BaseMessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const removedTracks = subscription.stop() ?? 0;

    return {
      embeds: [
        {
          color: Colors.Aqua,
          description: `${member.toString()} stopped the playback and **${removedTracks}** track${
            removedTracks > 1 ? 's were' : ' was'
          } removed from the queue.`,
        },
      ],
    };
  }

  pause(options: { user: User; textChannel?: TextBasedChannel | null }): BaseMessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const paused = subscription.audioPlayer.pause();
    if (!paused) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_PAUSE_FAILED }],
      };
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} paused the playback.` }],
    };
  }

  resume(options: { user: User; textChannel?: TextBasedChannel | null }): BaseMessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    const resumed = subscription.audioPlayer.unpause();
    if (!resumed) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_RESUME_FAILED }],
      };
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} resumed the playback.` }],
    };
  }

  pauseplay(options: { user: User; textChannel?: TextBasedChannel | null }): BaseMessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    let result;

    switch (subscription.audioPlayer.state.status) {
      case AudioPlayerStatus.Paused: {
        result = this.resume(options);
        break;
      }
      case AudioPlayerStatus.Playing: {
        result = this.pause(options);
        break;
      }
      default: {
        result = {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_PAUSEPLAY_FAILED }],
        };
      }
    }

    return result;
  }

  list(options: { user: User; textChannel?: TextBasedChannel | null }): BaseMessageOptions {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);
    if (!subscription) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_NOT_ACTIVE }],
      };
    }

    if (subscription.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      return {
        embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_PLAYER_IDLE }],
      };
    }

    const resource = subscription.audioPlayer.state.resource as AudioResource<MusicTrack>;
    const nowPlaying = resource.metadata.info.toFormattedString();

    let trackCount = 0;
    const onQueue: string[] = [];
    for (const handler of subscription.handlers) {
      if (handler.totalTracks > 1) {
        if (handler.tracksLoaded) {
          for (const track of handler.tracks) {
            onQueue.push(`${trackCount++}) ${track.info.toFormattedString()}`);
          }
        } else {
          onQueue.push(
            `${trackCount}-${
              trackCount + handler.totalTracks - 1
            }) ${handler.loadedInfo?.toFormattedString()} [${handler.totalTracks} tracks]`,
          );
          trackCount += handler.totalTracks;
        }
      } else {
        onQueue.push(`${trackCount++}) ${handler.loadedInfo?.toFormattedString()}`);
      }
    }

    let description = `**Now Playing**:\n${nowPlaying}`;
    if (onQueue.length > 1) {
      let index = onQueue.length;
      do {
        description = `**Now Playing**:\n${nowPlaying}\n\n**On Queue: ${trackCount - 1}**\n${onQueue
          .slice(1, index--)
          .join('\n')}`;
      } while (description.length > 4096 && index > 0);
    }

    const embed = new EmbedBuilder({
      author: { name: 'Parallax Music Player: Music List' },
      description: description,
      color: Colors.Aqua,
    });

    return { embeds: [embed] };
  }

  async disconnect(options: {
    user: User;
    textChannel?: TextBasedChannel | null;
  }): Promise<BaseMessageOptions> {
    const guild =
      options.textChannel instanceof GuildChannel
        ? options.textChannel.guild
        : this.bot.client.guilds.cache.find(
            g => typeof g.members.resolve(options.user)?.voice.channelId === 'string',
          );
    const member = guild?.members.resolve(options.user);
    const voiceChannel = member?.voice.channel;
    const checkResult = this.checkChannel(voiceChannel);

    if (!guild || !member || !voiceChannel || checkResult) {
      return (
        checkResult ?? {
          embeds: [{ color: Colors.Fuchsia, description: Constants.MUSIC_CONTROLS_DENY }],
        }
      );
    }

    const subscription = this.subscriptions.get(guild.id);

    if (subscription) {
      await subscription.terminate();
    } else {
      guild.members.me?.voice.disconnect();
    }

    return {
      embeds: [{ color: Colors.Aqua, description: `${member} turned off the player.` }],
    };
  }
}
