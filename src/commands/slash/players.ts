import {
  ApplicationCommandSubCommandData,
  ChatInputApplicationCommandData,
  CommandInteraction,
  Guild,
  GuildMember,
  MessageEmbed,
  Role,
} from 'discord.js';
import _ from 'lodash';
import cron from 'node-cron';
import { client } from '../../main.js';
import { game_prefix } from '../../managers/game.js';
import { play_prefix } from '../../managers/play.js';
import { getGame, getGameConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { fetchImage } from '../../utils/functions.js';

export default class Players extends Command {
  private _playersoptions = [] as ApplicationCommandSubCommandData[];

  constructor() {
    super(
      {
        name: 'players',
        description: 'Show the list of players of a game.',
        type: 'CHAT_INPUT',
        defaultPermission: true,
        options: [],
      },
      {
        scope: 'guild',
        guilds: async guild => {
          const config = await getGameConfig(guild.id);
          if (config?.enabled) return true;
          return false;
        },
      },
    );
  }

  registerPartitionAsSubcommand(partition: Role[], iteration = 0): void {
    const start = partition[0].name.toLowerCase().charAt(game_prefix.length);
    const end = partition[partition.length - 1].name.toLowerCase().charAt(game_prefix.length);
    const this_name = `${start}_to_${end}${iteration ? `_${iteration}` : ''}`;
    if (this._playersoptions.map(option => option.name).includes(this_name)) {
      this.registerPartitionAsSubcommand(partition, ++iteration);
    } else {
      this._playersoptions.push({
        name: this_name,
        description: `Show the list of players of a game. (${start.toUpperCase()} to ${end.toUpperCase()})`,
        type: 'SUB_COMMAND',
        options: [
          {
            name: 'game',
            description: 'Select the game you want to check.',
            type: 'STRING',
            choices: partition.map(role => ({
              name: role.name.replace(game_prefix, ''),
              value: role.id,
            })),
            required: true,
          },
        ],
      });
    }
  }

  async init(): Promise<void> {
    const template = _.cloneDeep(this.data);

    const init_this = async () => {
      for (const guild of client.guilds.cache.values()) {
        const data = _.cloneDeep(template) as ChatInputApplicationCommandData;
        this._playersoptions = [];

        const partitions = [] as Role[][];
        const games = [] as Role[];
        const game_roles = [
          ...guild.roles.cache.filter(r => r.name.startsWith(game_prefix)).values(),
        ];
        for (const role of game_roles) {
          const game = await getGame(role.name.replace(game_prefix, ''));
          if (game) games.push(role);
        }
        const games_alphabetical = games.sort(
          (a, b) => a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0),
        );
        for (const game of games_alphabetical.values()) {
          // Initialize the first and the next partition
          if (!partitions.length || partitions[partitions.length - 1].length >= 15) {
            partitions.push([]);
          }
          partitions[partitions.length - 1].push(game);
        }

        for (const partition of partitions) this.registerPartitionAsSubcommand(partition);

        if (this._playersoptions.length) {
          data.options = this._playersoptions;
          this.patch(data);
          await super.init(guild);
        } else {
          await guild.commands.fetch();
          const this_command = guild.commands.cache.find(
            c => c.name === this.data.name && c.type === this.data.type,
          );
          if (this_command) await this_command.delete();
        }
      }
    };

    await init_this();
    cron.schedule('*/60 * * * *', init_this);
  }

  async exec(interaction: CommandInteraction): Promise<unknown> {
    const guild = interaction.guild as Guild;

    await interaction.deferReply({ ephemeral: true });

    const game_id = interaction.options.getString('game', true);
    const game_role = guild.roles.cache.get(game_id);
    if (!game_role) return interaction.editReply('This game is no longer valid.');

    const ingame = [] as GuildMember[];
    const inothergame = [] as GuildMember[];
    const online = [] as GuildMember[];
    const unavailable = [] as GuildMember[];
    const offline = [] as GuildMember[];

    game_role.members
      .sort((a, b) => {
        const char_a = a.displayName.toLowerCase().charCodeAt(0);
        const char_b = b.displayName.toLowerCase().charCodeAt(0);
        return char_a - char_b;
      })
      .forEach(member => {
        if (member.roles.cache.some(r => r.name.startsWith(play_prefix))) {
          if (
            member.roles.cache.some(
              r => r.name === game_role.name.replace(game_prefix, play_prefix),
            )
          ) {
            ingame.push(member);
          } else {
            inothergame.push(member);
          }
        } else {
          switch (member.presence?.status) {
            case 'online':
              online.push(member);
              break;
            case 'dnd':
            case 'idle':
              unavailable.push(member);
              break;
            default:
              offline.push(member);
              break;
          }
        }
      });

    const image = await fetchImage(game_role.name.replace(game_prefix, ''));
    const embed = new MessageEmbed({
      author: { name: `${guild.name}: List of Players` },
      title: game_role.name.replace(game_prefix, ''),
      description: 'All players who played this game for the last 7 days are as follows:',
      footer: {
        text: `This game is being played by a total of ${game_role.members.size} players.`,
      },
      thumbnail: { url: image?.iconUrl },
      image: { url: image?.bannerUrl },
      color: game_role.color,
    });

    if (ingame.length) {
      embed.addField(`In Game: ${ingame.length}`, ingame.join(', '));
    }
    if (inothergame.length) {
      embed.addField(`In Other Game: ${inothergame.length}`, inothergame.join(', '));
    }
    if (online.length) {
      embed.addField(`Online: ${online.length}`, online.join(', '));
    }
    if (unavailable.length) {
      embed.addField(`Busy or AFK: ${unavailable.length}`, unavailable.join(', '));
    }
    if (offline.length) {
      embed.addField(`Offline: ${offline.length}`, offline.join(', '));
    }

    return interaction.editReply({ embeds: [embed] });
  }
}
