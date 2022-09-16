import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  CacheType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
} from 'discord.js';
import type Bot from '../../../modules/bot.js';
import { CommandScope } from '../../../schemas/enums.js';
import SlashCommand from '../../../structures/command_slash.js';

export default class SudoSlashCommand extends SlashCommand {
  _lastResult?: unknown;
  _hrStart?: [number, number];

  constructor(bot: Bot) {
    super(
      bot,
      {
        name: 'sudo',
        description: 'Executes a command as a superuser.',
        type: ApplicationCommandType.ChatInput,
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
        guilds: async guild => {
          const { database } = bot.managers;
          const constrolServerId = await database.botConfig('ControlServerId');
          return constrolServerId === guild.id;
        },
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    await interaction.deferReply({ ephemeral: true });

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
    const result = this._makeResult(this._lastResult);

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

  _callback(interacton: ChatInputCommandInteraction, value: unknown): void {
    const hrDiff = process.hrtime(this._hrStart);
    const isError = value instanceof Error;
    const result = this._makeResult(value);

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

  _followup(interacton: ChatInputCommandInteraction, value: unknown): void {
    const hrDiff = process.hrtime(this._hrStart);
    const isError = value instanceof Error;
    const result = this._makeResult(value);

    interacton.editReply({
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

  _makeResult(data: unknown): string[] {
    const inspected = this.bot.utils.inspect(data);
    const last = inspected.length - 1;
    const splitInspected = inspected.split('\n');

    const prependPart =
      inspected[0] !== '{' && inspected[0] !== '[' && inspected[0] !== "'"
        ? splitInspected[0]
        : inspected[0];

    const appendPart =
      inspected[last] !== '}' && inspected[last] !== ']' && inspected[last] !== "'"
        ? splitInspected[splitInspected.length - 1]
        : inspected[last];

    const result = this.bot.utils.splitString(inspected, {
      header: '```js\n',
      footer: '\n```',
      append: appendPart,
      prepend: prependPart,
      maxLength: 4096,
    });

    return result;
  }
}
