import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  type CacheType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
} from 'discord.js';
import type Bot from '../../../../modules/bot.js';
import Utils from '../../../../static/utils.js';
import { SlashCommand } from '../../command.js';
import { CommandScope } from '../../interaction_defs.js';

export default class SudoSlashCommand extends SlashCommand {
  private _lastResult?: unknown;
  private _hrStart?: [number, number];

  constructor(bot: Bot) {
    super(
      bot,
      {
        name: 'sudo',
        description: 'Executes a command as a superuser.',
        type: ApplicationCommandType.ChatInput,
        integrationTypes: [ApplicationIntegrationType.GuildInstall],
        defaultMemberPermissions: 'Administrator',
        options: [
          {
            name: 'command',
            description: 'The command to execute.',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        scope: CommandScope.Guild,
        guilds: guild => guild.id === bot.guild?.id,
      },
    );
  }

  private _callback(interacton: ChatInputCommandInteraction, value: unknown): void {
    const hrDiff = process.hrtime(this._hrStart);
    const isError = value instanceof Error;
    const result = Utils.formatToJs(value);

    interacton.editReply({
      embeds: result.map(
        r =>
          new EmbedBuilder({
            description: r,
            footer: {
              text: `Callback executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${
                hrDiff[1] / 1000000
              } ms.`,
            },
            color: isError ? Colors.Fuchsia : Colors.Blurple,
          }),
      ),
    });
  }

  private _followup(interacton: ChatInputCommandInteraction, value: unknown): void {
    const hrDiff = process.hrtime(this._hrStart);
    const isError = value instanceof Error;
    const result = Utils.formatToJs(value);

    interacton.followUp({
      embeds: result.map(
        r =>
          new EmbedBuilder({
            description: r,
            footer: {
              text: `Followup executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${
                hrDiff[1] / 1000000
              } ms.`,
            },
            color: isError ? Colors.Fuchsia : Colors.Blurple,
          }),
      ),
    });
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    await interaction.deferReply();

    let command = interaction.options.getString('command', true);

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const lastResult = this._lastResult;
    const callback = (value: unknown) => this._callback(interaction, value);
    const followup = (value: unknown) => this._followup(interaction, value);
    /* eslint-enable @typescript-eslint/no-unused-vars */

    if (command.startsWith('```') && command.endsWith('```')) {
      command = command.replace(/(^.*?\s)|(\n.*$)/g, '');
    }

    let hrDiff: [number, number];
    try {
      const hrStart = process.hrtime();
      this._lastResult = eval(command);
      hrDiff = process.hrtime(hrStart);
    } catch (err) {
      return interaction.editReply(`Command Failed: \`${err}\``);
    }

    // Prepare for callback time and respond
    this._hrStart = process.hrtime();
    const isError = this._lastResult instanceof Error;
    const result = Utils.formatToJs(this._lastResult);

    interaction.editReply({
      embeds: result.map(
        r =>
          new EmbedBuilder({
            description: r,
            footer: {
              text: `Executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${
                hrDiff[1] / 1000000
              } ms.`,
            },
            color: isError ? Colors.Fuchsia : Colors.Blurple,
          }),
      ),
    });
  }
}
