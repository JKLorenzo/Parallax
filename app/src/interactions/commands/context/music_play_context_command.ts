import {
  ApplicationCommandType,
  type CacheType,
  Colors,
  ContextMenuCommandInteraction,
} from 'discord.js';
import type Bot from '../../../modules/bot.js';
import { CommandScope } from '../../../schemas/enums.js';
import ContextCommand from '../../../structures/command_context.js';

export default class MusicPlayContextCommand extends ContextCommand {
  constructor(bot: Bot) {
    super(
      bot,
      {
        name: 'Music: Play',
        type: ApplicationCommandType.Message,
      },
      { scope: CommandScope.Global },
    );
  }

  async exec(interaction: ContextMenuCommandInteraction<CacheType>) {
    const { music } = this.bot.managers;
    const { constants, hasAny } = this.bot.utils;
    const user = interaction.user;
    const message = interaction.options.getMessage('message', true);
    let query = message.content;
    let textChannel = interaction.channel;

    // Decline messages sent by other bots
    if (message.author.bot && message.author.id !== this.bot.client.user?.id) {
      return interaction.reply({
        embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_BOT_MSG_NOT_SUPPORTED }],
      });
    }

    // Try parse embed
    if (query.length === 0 && message.embeds.length > 0) {
      const embed = message.embeds[0];

      if (embed.author?.name.startsWith('Parallax Music Player') && embed.url) {
        // Handles Now Playing/Paused/Previously Played embeds
        query = embed.url;
      } else if (
        embed.description?.startsWith('Enqueued ') &&
        hasAny(embed.description, '](http')
      ) {
        // Handles Music Play command results
        query = embed.description
          .split('](')
          .find(d => d.startsWith('http'))!
          .split(')')[0];
      } else {
        return interaction.reply({
          embeds: [{ color: Colors.Fuchsia, description: constants.MUSIC_MSG_NOT_SUPPORTED }],
        });
      }
    }

    await interaction.deferReply();

    if (!textChannel || textChannel.isDMBased()) {
      textChannel = await user.createDM();
    }

    const result = await music.play({ user, textChannel, query });

    await interaction.editReply(result);
  }
}
