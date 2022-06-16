import {
  ApplicationCommandData,
  ApplicationCommandOptionData,
  ChatInputApplicationCommandData,
  CommandInteraction,
  Guild,
  Role,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import _ from 'lodash';
import cron from 'node-cron';
import { client } from '../../main.js';
import { game_prefix } from '../../managers/game.js';
import { getGame, getGameConfig } from '../../modules/database.js';
import Command from '../../structures/command.js';
import { fetchImage } from '../../utils/functions.js';

export default class Invite extends Command {
  private _template: ApplicationCommandData;
  private _optionsData = [] as ApplicationCommandOptionData[];

  constructor() {
    super(
      {
        name: 'invite',
        description: 'Invite other members to play a game.',
        type: 'CHAT_INPUT',
        defaultPermission: true,
        options: [],
      },
      {
        scope: 'guild',
        guilds: async guild => {
          const config = await getGameConfig(guild.id);
          if (!config?.enabled) return false;
          if (!guild.me!.permissions.has('MANAGE_EVENTS')) return false;
          return true;
        },
      },
    );

    this._template = _.cloneDeep(this.data);
  }

  registerPartitionAsSubCommand(partition: Role[], iteration = 0): void {
    const start = partition[0].name.toLowerCase().charAt(game_prefix.length);
    const end = partition[partition.length - 1].name.toLowerCase().charAt(game_prefix.length);
    const this_name = `${start}_to_${end}${iteration ? `_${iteration}` : ''}`;
    if (this._optionsData.map(option => option.name).includes(this_name)) {
      this.registerPartitionAsSubCommand(partition, ++iteration);
    } else {
      this._optionsData.push({
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
            name: 'channel',
            description: 'Select which channel you want this game invite to take place.',
            type: 'CHANNEL',
            channelTypes: ['GUILD_VOICE'],
          },
        ],
      });
    }
  }

  async _init(): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
      this._optionsData = [];

      const games = [] as Role[];
      const partitions = [] as Role[][];
      const data = { ...this._template } as ChatInputApplicationCommandData;
      const roles = [...guild.roles.cache.filter(r => r.name.startsWith(game_prefix)).values()];

      for (const role of roles) {
        const game = await getGame(role.name.replace(game_prefix, ''));
        if (game) games.push(role);
      }

      const sortedGames = games.sort(
        (a, b) =>
          -[a.name.toLowerCase(), b.name.toLowerCase()].sort().indexOf(b.name.toLowerCase()),
      );

      for (const game of sortedGames.values()) {
        // Initialize the first and the next partition
        if (!partitions.length || partitions[partitions.length - 1].length >= 15) {
          partitions.push([]);
        }
        partitions[partitions.length - 1].push(game);
      }

      for (const partition of partitions) this.registerPartitionAsSubCommand(partition);

      if (this._optionsData.length) {
        data.options = this._optionsData;
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
  }

  async init(): Promise<void> {
    await this._init();
    cron.schedule('*/60 * * * *', this._init);
  }

  async exec(interaction: CommandInteraction): Promise<unknown> {
    const guild = interaction.guild as Guild;

    await interaction.deferReply({ ephemeral: true });

    const config = await getGameConfig(guild.id);
    if (!config || !config.enabled || !config.invite_channel) return;
    const invite_channel = guild.channels.cache.get(config.invite_channel) as
      | TextChannel
      | undefined;
    if (!invite_channel) return;

    const game_id = interaction.options.getString('game', true);

    const game_role = guild.roles.cache.get(game_id);
    if (!game_role) return;

    const defaultDescription = `${interaction.user} is inviting you to play ${game_role}.`;

    const name = game_role.name.replace(game_prefix, '');
    const description = interaction.options.getString('description');
    const channel = interaction.options.getChannel('channel') as VoiceChannel | null;
    const image = await fetchImage(game_role.name.replace(game_prefix, ''));

    const now = Date.now() + 300000;
    const oneHourFromNow = now + 3600000;

    const event = await guild.scheduledEvents.create({
      name: name,
      description: defaultDescription + (description ? `\n${description}` : ''),
      channel: channel ?? undefined,
      entityType: channel ? 'VOICE' : 'EXTERNAL',
      entityMetadata: { location: channel ? undefined : guild.name },
      privacyLevel: 'GUILD_ONLY',
      image: image?.bannerUrl,
      scheduledStartTime: now,
      scheduledEndTime: oneHourFromNow,
      reason: 'Parallax Game Coordinator',
    });

    const invite_message = await invite_channel.send({
      content: `${defaultDescription}\n${event.url}`,
    });

    await interaction.editReply(
      `Got it! [This invite](${invite_message.url}) is now available on the ${invite_channel} channel.`,
    );
  }
}
