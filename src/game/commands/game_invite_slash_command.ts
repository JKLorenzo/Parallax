import {
  type ApplicationCommandOptionChoiceData,
  type ApplicationCommandOptionData,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  AutocompleteInteraction,
  type CacheType,
  type Channel,
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
} from 'discord.js';
import { CommandScope, SlashCommandAutoComplete } from '../../modules/command.js';
import { client } from '../../main.js';
import { CSConstants, QGConstants } from '../../misc/constants.js';
import DatabaseFacade from '../../database/database_facade.js';
import GameManager from '../game_manager.js';
import Utils from '../../misc/utils.js';
import { GameStatus } from '../../database/database_defs.js';

const slot = (i: number) => `reserve_slot_${i}`;

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
          ...GameManager.rsvpArray.map(i => {
            const data: ApplicationCommandOptionData = {
              name: slot(i),
              description: 'Reserve a slot for a user.',
              type: ApplicationCommandOptionType.String,
              autocomplete: true,
            };
            return data;
          }),
          {
            name: 'max_slots',
            description: 'Automatically close the game invite once this number is reached.',
            type: ApplicationCommandOptionType.Integer,
            autocomplete: true,
          },
          {
            name: 'time',
            description: 'Automatically close the game invite after the set time.',
            type: ApplicationCommandOptionType.Integer,
            choices: [
              {
                name: '5 minutes',
                value: 5,
              },
              {
                name: '10 minutes',
                value: 10,
              },
              {
                name: '15 minutes',
                value: 15,
              },
              {
                name: '30 minutes',
                value: 30,
              },
              {
                name: '1 hour',
                value: 60,
              },
              {
                name: '1 hour and 30 minutes',
                value: 90,
              },
              {
                name: '2 hours',
                value: 120,
              },
            ],
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

    await interaction.deferReply();

    let guild: Guild | undefined = interaction.guild ?? undefined;
    let channel: Channel | undefined = interaction.channel ?? undefined;

    if (!interaction.inGuild()) {
      guild = client.guilds.cache.get(QGConstants.GUILD_ID);
      channel = guild?.channels.cache.get(QGConstants.GENERAL_TEXT_CHANNEL_ID);

      guild ??= client.guilds.cache.get(CSConstants.GUILD_ID);
      channel ??= guild?.channels.cache.get(CSConstants.GENERAL_TEXT_CHANNEL_ID);
    }

    if (!guild) return await interaction.editReply("Can't determine guild.");
    if (!channel?.isSendable()) return await interaction.editReply("Can't determine channel.");

    const applicationId = interaction.options.getString('game', true);
    const guildGame = await db.guildGameData(guild.id, applicationId);
    const roleId = guildGame?.roleId;
    if (!roleId) return await interaction.editReply('This game is not available.');

    const role = guild.roles.cache.get(roleId);
    if (!role) return await interaction.editReply('This game is not available.');

    const joinerIds: string[] = [];
    for (let i = 2; i <= 10; i++) {
      const joinerId = interaction.options.getString(slot(i));
      if (!joinerId) continue;
      const joiner = guild.members.cache.get(joinerId);
      if (joiner) joinerIds.push(joiner.id);
    }

    const maxSlots = interaction.options.getInteger('max_slots') ?? undefined;
    const time = interaction.options.getInteger('time') ?? undefined;

    const message = await gm.inviteOperator.createGameInvite(
      interaction.user.id,
      channel,
      role,
      joinerIds,
      maxSlots,
      time,
    );
    if (!message) return await interaction.editReply('This game is not available.');

    await interaction.editReply(`A [game invite](${message.url}) has been created!`);
  }

  async autocomplete(interaction: AutocompleteInteraction<CacheType>) {
    const focused = interaction.options.getFocused(true);

    let choices: ApplicationCommandOptionChoiceData[] = [];
    if (focused.name === 'game') {
      choices = await this.gameAutocomplete(focused.value);
    } else if (focused.name.startsWith('reserve_slot')) {
      choices = await this.reserveSlotAutocomplete(interaction, focused.value);
    } else if (focused.name === 'max_slots') {
      choices = await this.maxSlotsAutocomplete(interaction);
    }

    await interaction.respond(choices.slice(0, 25));
  }

  async gameAutocomplete(value: string) {
    const db = DatabaseFacade.instance();
    const results = await db.findGamesByPartialName(value);
    const choices: ApplicationCommandOptionChoiceData<string>[] = results
      .filter(r => r.status === GameStatus.Approved)
      .map(r => ({
        name: r.name!,
        value: r.id!,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return choices;
  }

  async reserveSlotAutocomplete(interaction: AutocompleteInteraction<CacheType>, value: string) {
    let guild = interaction.guild ?? undefined;
    guild ??= client.guilds.cache.get(QGConstants.GUILD_ID);
    guild ??= client.guilds.cache.get(CSConstants.GUILD_ID);

    let members = guild?.members.cache.filter(m => !m.user.bot && m.id !== interaction.user.id);
    if (!guild || !members) return [];

    const joinerIds: string[] = [];
    for (let i = GameManager.rsvpMin; i <= GameManager.rsvpMax; i++) {
      const joinerId = interaction.options.getString(slot(i));
      if (!joinerId) continue;
      const joiner = guild.members.cache.get(joinerId);
      if (joiner) joinerIds.push(joiner.id);
    }
    members = members.filter(m => !joinerIds.includes(m.id));

    const getMemberChoiceName = (m: GuildMember) => `${m.displayName} (${m.user.username})`;
    const name = value.trim().toLowerCase();
    if (name.length > 0) {
      members = members.filter(m => Utils.hasAny(getMemberChoiceName(m).toLowerCase(), name));
    }

    const choices: ApplicationCommandOptionChoiceData<string>[] = members
      .map(m => ({
        name: getMemberChoiceName(m),
        value: m.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return choices;
  }

  async maxSlotsAutocomplete(interaction: AutocompleteInteraction<CacheType>) {
    let guild = interaction.guild ?? undefined;
    guild ??= client.guilds.cache.get(QGConstants.GUILD_ID);
    guild ??= client.guilds.cache.get(CSConstants.GUILD_ID);

    if (!guild) return [];

    const joinerIds: string[] = [];
    for (let i = GameManager.rsvpMin; i <= GameManager.rsvpMax; i++) {
      const joinerId = interaction.options.getString(slot(i));
      if (!joinerId) continue;
      const joiner = guild.members.cache.get(joinerId);
      if (joiner) joinerIds.push(joiner.id);
    }

    const minSlot = GameManager.rsvpMin + joinerIds.length;
    const choices: ApplicationCommandOptionChoiceData<number>[] = [];
    for (let i = minSlot; i <= GameManager.rsvpMax; i++) choices.push({ name: `${i}`, value: i });

    return choices;
  }
}
