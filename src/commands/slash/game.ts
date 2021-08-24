import { setTimeout } from 'timers/promises';
import {
  ApplicationCommandNonOptionsData,
  ApplicationCommandOptionChoice,
  ApplicationCommandSubCommandData,
  ChatInputApplicationCommandData,
  CommandInteraction,
  GuildMember,
  MessageEmbed,
  Role,
} from 'discord.js';
import _ from 'lodash';
import cron from 'node-cron';
import { client } from '../../main.js';
import { getComponent } from '../../managers/interaction.js';
import { play_prefix } from '../../managers/play.js';
import { getGameConfig, getGuildGameRoles } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { fetchImage, hexToUtf } from '../../utils/functions.js';

export default class Game extends Command {
  private _inviteoptions: ApplicationCommandSubCommandData[];
  private _playersoptions: ApplicationCommandSubCommandData[];

  constructor() {
    super('guild', {
      name: 'game',
      description: 'Contains all the game commands for this server.',
      type: 'CHAT_INPUT',
      defaultPermission: true,
      options: [
        {
          name: 'invite',
          description: 'Invite other members to play a game',
          type: 'SUB_COMMAND_GROUP',
          options: [],
        },
        {
          name: 'players',
          description: 'Show the list of players of a game.',
          type: 'SUB_COMMAND_GROUP',
          options: [],
        },
      ],
    });

    this._inviteoptions = [];
    this._playersoptions = [];
  }

  registerPartitionAsSubcommand(partition: Role[], iteration = 0): void {
    const start = partition[0].name.substring(0, 1).toLowerCase();
    const end = partition[partition.length - 1].name.substring(0, 1).toLowerCase();
    const this_name = `${start}_to_${end}${iteration ? `_${iteration}` : ''}`;
    if (this._inviteoptions.map(option => option.name).includes(this_name)) {
      this.registerPartitionAsSubcommand(partition, ++iteration);
    } else {
      const player_count_choices = [] as ApplicationCommandOptionChoice[];
      for (let i = 2; i <= 25; i++) player_count_choices.push({ name: `${i}`, value: i });

      const reserved_options = [] as ApplicationCommandNonOptionsData[];
      for (let i = 1; i <= 10; i++) {
        reserved_options.push({
          name: `reserved_${i}`,
          description: 'Select the user to reserve in this game invite bracket.',
          type: 'USER',
        });
      }

      this._inviteoptions.push({
        name: this_name,
        description: `Invite other members to play a game. (${start.toUpperCase()} to ${end.toUpperCase()})`,
        type: 'SUB_COMMAND',
        options: [
          {
            name: 'game',
            description: 'Select the game you want to play.',
            type: 'STRING',
            choices: partition.map(role => ({
              name: role.name,
              value: role.id,
            })),
            required: true,
          },
          {
            name: 'description',
            description: 'Enter a custom message to be added into this game invite.',
            type: 'STRING',
          },
          {
            name: 'player_count',
            description: 'Enter the maximum number of players for this bracket. (Max 25)',
            type: 'INTEGER',
            choices: player_count_choices,
          },
          ...reserved_options,
        ],
      });

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
              name: role.name,
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
        this._inviteoptions = [];
        this._playersoptions = [];

        const partitions = [] as Role[][];
        const game_roles = await getGuildGameRoles(guild.id);
        const games = guild.roles.cache.filter(r => [...game_roles.values()].includes(r.id));
        const games_alphabetical = games.sort(
          (a, b) => a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0),
        );
        for (const game of games_alphabetical.values()) {
          // Initialize the first and the next partition
          if (!partitions.length || partitions[partitions.length - 1].length > 14) {
            partitions.push([]);
          }
          partitions[partitions.length - 1].push(game);
        }

        for (const partition of partitions) {
          this.registerPartitionAsSubcommand(partition);
        }

        if (data.options && (this._inviteoptions.length || this._playersoptions.length)) {
          data.options = data.options.map(option => {
            if (option.type !== 'SUB_COMMAND_GROUP') return option;
            if (option.name === 'invite') option.options = this._inviteoptions;
            if (option.name === 'players') option.options = this._playersoptions;
            return option;
          });
        } else if (data.options) {
          data.options = data.options.filter(o => o.name !== 'invite' && o.name !== 'players');
        }

        this.patch(data);
        await super.init(guild);
      }
    };

    await init_this();
    cron.schedule('*/60 * * * *', init_this);
  }

  async exec(interaction: CommandInteraction): Promise<unknown> {
    const subcommand_group = interaction.options.getSubcommandGroup();

    // Block dm commands
    if (!interaction.inGuild()) {
      return interaction.reply('This is only available on a guild channel.');
    }

    if (subcommand_group === 'invite') {
      await interaction.deferReply({ ephemeral: true });

      const config = await getGameConfig(interaction.guildId);
      if (!config || !config.enabled || !config.invite_channel) {
        return interaction.editReply('This command is currently disabled or is not set up.');
      }
      const invite_channel = interaction.guild?.channels.cache.get(config.invite_channel);
      if (!invite_channel || invite_channel.isThread() || !invite_channel.isText()) {
        return interaction.editReply('The invites channel does not exist or is invalid.');
      }

      const game_id = interaction.options.getString('game', true);
      const description = interaction.options.getString('description');
      const player_count = interaction.options.getInteger('player_count');
      const reserved_players = [] as string[];
      for (let i = 1; i < 10; i++) {
        const user = interaction.options.getUser(`reserved_${i}`);
        if (
          user &&
          user.id !== interaction.user.id &&
          !reserved_players.includes(user.toString())
        ) {
          reserved_players.push(user.toString());
        }
      }

      const game_role = interaction.guild?.roles.cache.get(game_id);
      if (!game_role) return interaction.editReply('This game is no longer valid.');

      const games = await getGuildGameRoles(interaction.guildId);
      let game_name = '';
      for (const [hex_name, role_id] of games) {
        if (role_id === game_id) {
          game_name = hexToUtf(hex_name);
          break;
        }
      }

      const image = game_name ? await fetchImage(game_name) : undefined;
      const embed = new MessageEmbed({
        author: { name: `${interaction.guild}: Game Invites` },
        title: game_role.name,
        description:
          description ??
          `${interaction.user} is looking for ${
            player_count ? `${player_count} other` : ''
          } ${game_role} players.`,
        fields: [
          {
            name: 'Player 1',
            value: interaction.user.toString(),
          },
          ...reserved_players.map((r, i) => ({
            name: `Player ${i + 2}`,
            value: r,
          })),
        ],
        footer: {
          text: `Join this ${player_count ? 'limited ' : ''}bracket by clicking the buttons below.`,
        },
        thumbnail: { url: image?.iconUrl },
        image: { url: image?.bannerUrl },
        color: game_role.color,
      });

      if (player_count) {
        for (let i = embed.fields.length; i < player_count; i++) {
          embed.addField(`Player ${i + 1}:`, 'Slot Available');
        }
      }

      const invite_message = await invite_channel.send({
        content: `${interaction.user} is inviting you to play ${game_role}`,
        embeds: [embed],
        components: getComponent('game_invite'),
      });

      setTimeout(1800000, () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        if (invite_message) invite_message.delete().catch(() => {});
      });

      return interaction.editReply(
        `Got it! [This bracket](${invite_message.url}) is now available on the ${invite_channel} channel.`,
      );
    } else if (subcommand_group === 'players') {
      await interaction.deferReply({ ephemeral: true });

      const game_id = interaction.options.getString('game', true);
      const game_role = interaction.guild?.roles.cache.get(game_id);
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
            if (member.roles.cache.some(r => r.name === `${play_prefix}${game_role.name}`)) {
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

      const games = await getGuildGameRoles(interaction.guildId);
      let game_name = '';
      for (const [hex_name, role_id] of games) {
        if (role_id === game_id) {
          game_name = hexToUtf(hex_name);
          break;
        }
      }

      const image = game_name ? await fetchImage(game_name) : undefined;
      const embed = new MessageEmbed({
        author: { name: `${interaction.guild?.name}: List of Players` },
        title: game_role.name,
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
}
