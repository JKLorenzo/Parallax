import {
  ApplicationCommandNonOptionsData,
  ApplicationCommandOptionChoiceData,
  ApplicationCommandSubCommandData,
  ChatInputApplicationCommandData,
  CommandInteraction,
  Guild,
  MessageEmbed,
  Role,
} from 'discord.js';
import _ from 'lodash';
import cron from 'node-cron';
import { client } from '../../main.js';
import { game_prefix } from '../../managers/game.js';
import { getComponent } from '../../managers/interaction.js';
import { getGame, getGameConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { fetchImage } from '../../utils/functions.js';

export default class Game extends Command {
  private _inviteoptions = [] as ApplicationCommandSubCommandData[];

  constructor() {
    super(
      'guild',
      {
        name: 'invite',
        description: 'Invite other members to play a game.',
        type: 'CHAT_INPUT',
        defaultPermission: true,
        options: [],
      },
      {
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
    if (this._inviteoptions.map(option => option.name).includes(this_name)) {
      this.registerPartitionAsSubcommand(partition, ++iteration);
    } else {
      const player_count_choices = [] as ApplicationCommandOptionChoiceData[];
      for (let i = 2; i <= 10; i++) player_count_choices.push({ name: `${i}`, value: i });

      const reserved_inviteoptions = [] as ApplicationCommandNonOptionsData[];
      for (let i = 1; i <= 5; i++) {
        reserved_inviteoptions.push({
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
              name: role.name.replace(game_prefix, ''),
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
          ...reserved_inviteoptions,
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

        for (const partition of partitions) {
          this.registerPartitionAsSubcommand(partition);
        }

        if (this._inviteoptions.length) {
          data.options = this._inviteoptions;
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

    const config = await getGameConfig(guild.id);
    if (!config || !config.enabled || !config.invite_channel) {
      return interaction.editReply('This command is currently disabled or is not set up.');
    }
    const invite_channel = guild.channels.cache.get(config.invite_channel);
    if (!invite_channel || invite_channel.isThread() || !invite_channel.isText()) {
      return interaction.editReply('The invites channel does not exist or is invalid.');
    }

    const game_id = interaction.options.getString('game', true);
    const description = interaction.options.getString('description');
    const player_count = interaction.options.getInteger('player_count');
    const reserved_players = [] as string[];
    for (let i = 1; i <= 5; i++) {
      const user = interaction.options.getUser(`reserved_${i}`);
      if (user && user.id !== interaction.user.id && !reserved_players.includes(user.toString())) {
        reserved_players.push(user.toString());
      }
    }

    const game_role = guild.roles.cache.get(game_id);
    if (!game_role) return interaction.editReply('This game is no longer valid.');

    const image = await fetchImage(game_role.name.replace(game_prefix, ''));
    const embed = new MessageEmbed({
      author: { name: `${guild}: Game Invites` },
      title: game_role.name.replace(game_prefix, ''),
      description:
        description ??
        `${interaction.user} is looking for ${
          player_count ? `${player_count - 1} other` : ''
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

    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      if (invite_message) invite_message.delete().catch(() => {});
    }, 1800000);

    await interaction.editReply(
      `Got it! [This bracket](${invite_message.url}) is now available on the ${invite_channel} channel.`,
    );
  }
}
