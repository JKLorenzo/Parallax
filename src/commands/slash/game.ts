import { setTimeout } from 'timers/promises';
import {
  ApplicationCommandNonOptionsData,
  ApplicationCommandOptionChoice,
  ApplicationCommandSubCommandData,
  CommandInteraction,
  MessageEmbed,
  Role,
} from 'discord.js';
import _ from 'lodash';
import { client } from '../../main.js';
import { getComponent } from '../../managers/interaction.js';
import { getGameConfig, getGuildGameRoles } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { fetchImage, hexToUtf } from '../../utils/functions.js';

export default class Game extends Command {
  private _inviteoptions: ApplicationCommandSubCommandData[];

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
          name: 'override',
          description: 'Overrides the global game screening status of a game.',
          type: 'SUB_COMMAND_GROUP',
          options: [
            {
              name: 'allow',
              description: 'Overrides the global game screening status of a game.',
              type: 'SUB_COMMAND',
            },
            {
              name: 'deny',
              description: 'Overrides the global game screening status of a game.',
              type: 'SUB_COMMAND',
            },
            {
              name: 'default',
              description: 'Use the global game screening status for a game.',
              type: 'SUB_COMMAND',
            },
          ],
        },
      ],
    });

    this._inviteoptions = [];
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
        description: `Invite members to play a game. (${start.toUpperCase()} to ${end.toUpperCase()})`,
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
    }
  }

  async init(): Promise<void> {
    const template = _.cloneDeep(this.data);

    for (const guild of client.guilds.cache.values()) {
      const data = _.cloneDeep(template);
      this._inviteoptions = [];

      const partitions = [] as Role[][];
      const game_roles = await getGuildGameRoles(guild.id);
      const games = [
        ...guild.roles.cache.filter(r => [...game_roles.values()].includes(r.id)).values(),
      ];
      const games_alphabetical = games.map(r => r.name.toLowerCase()).sort();
      for (const game_name of games_alphabetical) {
        // Initialize the first and the next partition
        if (!partitions.length || partitions[partitions.length - 1].length > 24) {
          partitions.push([]);
        }
        const this_role = games.find(r => r.name.toLowerCase() === game_name);
        if (this_role) partitions[partitions.length - 1].push(this_role);
      }

      for (const partition of partitions) {
        this.registerPartitionAsSubcommand(partition);
      }

      if (data.type === 'CHAT_INPUT') {
        if (data.options && this._inviteoptions.length) {
          data.options = data.options.map(option => {
            if (option.name === 'invite' && option.type === 'SUB_COMMAND_GROUP') {
              option.options = this._inviteoptions;
            }
            return option;
          });
        } else if (data.options) {
          data.options = data.options.filter(o => o.name !== 'invite');
        }
      }

      this.patch(data);
      await super.init(guild);
    }
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
    }
  }
}
