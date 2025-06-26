import {
  type ApplicationCommandOptionChoiceData,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  AutocompleteInteraction,
  type CacheType,
  type Channel,
  ChatInputCommandInteraction,
  Guild,
} from 'discord.js';
import { CommandScope, SlashCommandAutoComplete } from '../../modules/command.js';
import { client } from '../../main.js';
import { QGConstants } from '../../misc/constants.js';
import DatabaseFacade from '../../database/database_facade.js';
import GameManager from '../game_manager.js';

export default class GameInviteSlashCommand extends SlashCommandAutoComplete {
  constructor() {
    super(
      {
        name: 'game_invite',
        description: 'Send a game invite where other members can join.',
        type: ApplicationCommandType.ChatInput,
        integrationTypes: [
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        ],
        options: [
          {
            name: 'game',
            description: 'The game you would like to create an invite.',
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true,
          },
          {
            name: 'reserve_slot_1',
            description: 'Reserve a slot for a user.',
            type: ApplicationCommandOptionType.User,
          },
          {
            name: 'reserve_slot_2',
            description: 'Reserve a slot for a user.',
            type: ApplicationCommandOptionType.User,
          },
          {
            name: 'reserve_slot_3',
            description: 'Reserve a slot for a user.',
            type: ApplicationCommandOptionType.User,
          },
          {
            name: 'reserve_slot_4',
            description: 'Reserve a slot for a user.',
            type: ApplicationCommandOptionType.User,
          },
          {
            name: 'reserve_slot_5',
            description: 'Reserve a slot for a user.',
            type: ApplicationCommandOptionType.User,
          },
          {
            name: 'max_slots',
            description: 'Automatically close the game invite once this number is reached.',
            type: ApplicationCommandOptionType.Integer,
            choices: [2, 3, 4, 5, 6, 7, 8, 9, 10].map(e => ({ name: `${e}`, value: e })),
          },
        ],
      },
      {
        scope: CommandScope.Global,
      },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const db = DatabaseFacade.instance();
    const gm = GameManager.instance();

    let guild: Guild | null | undefined = client.guilds.cache.get(QGConstants.GUILD_ID);
    let channel: Channel | null | undefined = guild?.channels.cache.get(
      QGConstants.GENERAL_TEXT_CHANNEL_ID,
    );
    if (interaction.guildId && interaction.guildId !== QGConstants.GUILD_ID) {
      guild = interaction.guild;
      channel = interaction.channel;
    }
    if (!guild) return;
    if (!channel?.isSendable()) return;

    await interaction.deferReply();

    const applicationId = interaction.options.getString('game', true);
    const guildGame = await db.guildGameData(guild.id, applicationId);
    const roleId = guildGame?.roleId;
    if (!roleId) return await interaction.editReply('This game is not available.');

    const role = guild.roles.cache.get(roleId);
    if (!role) return await interaction.editReply('This game is not available.');

    const joinerIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const joiner = interaction.options.getUser(`reserve_slot_${i}`);
      if (joiner) joinerIds.push(joiner.id);
    }

    const maxSlots = interaction.options.getInteger('max_slots') ?? undefined;
    const message = await gm.gameInvite(interaction.user.id, channel, role, joinerIds, maxSlots);
    if (!message) return await interaction.editReply('This game is not available.');

    await interaction.editReply(`A [game invite](${message.url}) has been created!`);
  }

  async autocomplete(interaction: AutocompleteInteraction<CacheType>) {
    const db = DatabaseFacade.instance();
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'game') {
      const results = await db.findGamesByPartialName(focused.value);
      const choices: ApplicationCommandOptionChoiceData<string>[] = results
        .map(r => ({
          name: r.name!,
          value: r.id!,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25);
      await interaction.respond(choices);
    }
  }
}
