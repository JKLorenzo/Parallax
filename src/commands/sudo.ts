import util from 'util';
import tags from 'common-tags';
import { CommandInteraction, MessageEmbed, Util } from 'discord.js';
import _ from 'lodash';
import { client } from '../main.js';
import { getBotConfig } from '../modules/database.js';
import GuildCommand from '../structures/guildcommand.js';

const nl = '!!NL!!';
const nlPattern = new RegExp(nl, 'g');

export default class Sudo extends GuildCommand {
  private _lastResult?: unknown;
  private _hrStart?: [number, number];
  private _sensitivePattern?: RegExp;

  constructor() {
    super(
      {
        name: 'sudo',
        description: 'Executes a command as a superuser.',
        defaultPermission: false,
        options: [
          {
            name: 'command',
            description: 'The command the execute.',
            type: 'STRING',
            required: true,
          },
        ],
      },
      {
        guilds: async guild => {
          const guildId = await getBotConfig('ControlServerId');
          if (!guildId || guildId !== guild.id) return false;
          return true;
        },
      },
    );
  }

  get sensitivePattern(): RegExp {
    if (!this._sensitivePattern) {
      let pattern = '';
      if (client.token) pattern += _.escapeRegExp(client.token);
      this._sensitivePattern = new RegExp(pattern, 'gi');
    }
    return this._sensitivePattern!;
  }

  async exec(interaction: CommandInteraction): Promise<unknown> {
    await interaction.deferReply({ ephemeral: true });

    let command = interaction.options.getString('command', true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const lastResult = this._lastResult;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const callback = (value: unknown) => this._callback(interaction, value);

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
    const result = this._makeResult(this._lastResult, hrDiff, command);
    interaction.editReply({ embeds: result.map(r => new MessageEmbed({ description: r })) });
  }

  _callback(interacton: CommandInteraction, value: unknown): void {
    if (value instanceof Error) {
      interacton.editReply(`Callback Failed: \`${value}\``);
    } else {
      const result = this._makeResult(value, process.hrtime(this._hrStart));
      interacton.editReply({ embeds: result.map(r => new MessageEmbed({ description: r })) });
    }
  }

  _makeResult(result: unknown, hrDiff: [number, number], command?: string): string[] {
    const inspected = util
      .inspect(result, { depth: 0 })
      .replace(nlPattern, '\n')
      .replace(this.sensitivePattern, '--snip--');

    const split = inspected.split('\n');
    const last = inspected.length - 1;

    const prependPart =
      inspected[0] !== '{' && inspected[0] !== '[' && inspected[0] !== "'"
        ? split[0]
        : inspected[0];

    const appendPart =
      inspected[last] !== '}' && inspected[last] !== ']' && inspected[last] !== "'"
        ? split[split.length - 1]
        : inspected[last];

    const prepend = `\`\`\`js\n${prependPart}\n`;
    const append = `\n${appendPart}\n\`\`\``;

    if (command) {
      return Util.splitMessage(
        tags.stripIndents`
				*Executed in ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${hrDiff[1] / 1000000}ms.*
				\`\`\`js
				${inspected}
				\`\`\`
			`,
        { maxLength: 3996, prepend, append },
      );
    } else {
      return Util.splitMessage(
        tags.stripIndents`
				*Callback executed after ${hrDiff[0] > 0 ? `${hrDiff[0]}s ` : ''}${hrDiff[1] / 1000000}ms.*
				\`\`\`js
				${inspected}
				\`\`\`
			`,
        { maxLength: 3996, prepend, append },
      );
    }
  }
}
