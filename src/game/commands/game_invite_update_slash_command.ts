import {
  type ChatInputCommandInteraction,
  type CacheType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  ApplicationCommandOptionType,
  type ApplicationCommandOptionData,
  AutocompleteInteraction,
  type ApplicationCommandOptionChoiceData,
  User,
  GuildMember,
} from 'discord.js';
import { CommandScope, SlashCommandAutoComplete } from '../../interaction/modules/command.js';
import GameManager from '../game_manager.js';
import DatabaseFacade from '../../database/database_facade.js';
import { client } from '../../main.js';
import Utils from '../../misc/utils.js';
import type { GameInviteData } from '../../database/database_defs.js';
import GameInviteComponent from '../components/game_invite_component.js';

const slot = (i: number) => `slot_${i}`;

export default class GameInviteUpdateSlashCommand extends SlashCommandAutoComplete {
  constructor() {
    super(
      {
        name: 'game_invite_update',
        description: 'Update an existing game invite.',
        type: ApplicationCommandType.ChatInput,
        integrationTypes: [
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        ],
        options: [
          {
            name: 'insert',
            description: 'Insert a player to an existing game invite.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'game_invite',
                description: 'The existing game invite you would like to update.',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true,
              },
              ...GameManager.rsvpArray.map(i => {
                const data: ApplicationCommandOptionData = {
                  name: `insert_${slot(i)}`,
                  description: 'Insert a user to this game invite.',
                  type: ApplicationCommandOptionType.String,
                  autocomplete: true,
                };
                return data;
              }),
            ],
          },
          {
            name: 'remove',
            description: 'Remove a player from an existing game invite.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'game_invite',
                description: 'The existing game invite you would like to update.',
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true,
              },
              ...GameManager.rsvpArray.map(i => {
                const data: ApplicationCommandOptionData = {
                  name: `remove_${slot(i)}`,
                  description: 'Remove a user from this game invite.',
                  type: ApplicationCommandOptionType.String,
                  autocomplete: true,
                };
                return data;
              }),
            ],
          },
        ],
      },
      { scope: CommandScope.Global },
    );
  }

  async exec(interaction: ChatInputCommandInteraction<CacheType>) {
    const db = DatabaseFacade.instance();

    await interaction.deferReply();

    const inviteId = interaction.options.getString('game_invite', true);
    const data = await db.gameInviteData(inviteId);
    if (!data) return;

    const command = interaction.options.getSubcommand();
    switch (command) {
      case 'insert':
        this.insert(interaction, data);
        break;
      case 'remove':
        this.remove(interaction, data);
        break;
      default:
    }
  }

  async insert(interaction: ChatInputCommandInteraction<CacheType>, data: GameInviteData) {
    const gm = GameManager.instance();

    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) return;

    const insertIds: string[] = [];
    for (let i = 2; i <= 10; i++) {
      const userId = interaction.options.getString(`insert_${slot(i)}`);
      if (!userId) continue;
      const user = guild.members.cache.get(userId);
      if (user) insertIds.push(user.id);
    }
    data.joinersId.push(...insertIds);

    const channel = guild.channels.cache.get(data.channelId);
    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(data.messageId);
    if (!message) return;

    const interactable = GameInviteComponent.createInteractable(data);
    await message.edit({ components: interactable.components });

    const players = [data.inviterId, ...data.joinersId];
    if (data.maxSlot && players.length >= data.maxSlot) {
      await gm.inviteOperator.closeGameInvite(data);
    }

    await interaction.editReply(`Game invite successfully updated.`);
  }

  async remove(interaction: ChatInputCommandInteraction<CacheType>, data: GameInviteData) {
    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) return;

    const removeIds: string[] = [];
    for (let i = 2; i <= 10; i++) {
      const userId = interaction.options.getString(`remove_${slot(i)}`);
      if (!userId) continue;
      const user = guild.members.cache.get(userId);
      if (user) removeIds.push(user.id);
    }
    data.joinersId = data.joinersId.filter(id => !removeIds.includes(id));

    const channel = guild.channels.cache.get(data.channelId);
    if (!channel?.isTextBased()) return;

    const message = await channel.messages.fetch(data.messageId);
    if (!message) return;

    const interactable = GameInviteComponent.createInteractable(data);
    await message.edit({ components: interactable.components });

    await interaction.editReply(`Game invite successfully updated.`);
  }

  async autocomplete(interaction: AutocompleteInteraction<CacheType>) {
    const focused = interaction.options.getFocused(true);

    let choices: ApplicationCommandOptionChoiceData[] = [];
    if (focused.name === 'game_invite') {
      choices = await this.gameInviteAutocomplete(interaction.user);
    } else if (focused.name.startsWith('insert_')) {
      choices = await this.insertSlotAutocomplete(interaction, focused.value);
    } else if (focused.name.startsWith('remove_')) {
      choices = await this.removeSlotAutocomplete(interaction, focused.value);
    }

    await interaction.respond(choices.slice(0, 25));
  }

  async gameInviteAutocomplete(user: User) {
    const db = DatabaseFacade.instance();
    const results = await db.findGameInvitesOfInviter(user.id);
    const choices: ApplicationCommandOptionChoiceData<string>[] = results
      .map(r => ({
        name: `${r.name} - ${r.id}`,
        value: r.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return choices;
  }

  async insertSlotAutocomplete(interaction: AutocompleteInteraction<CacheType>, value: string) {
    const db = DatabaseFacade.instance();

    const inviteId = interaction.options.getString('game_invite', true);
    const data = await db.gameInviteData(inviteId);
    if (!data) return [];

    const guild = client.guilds.cache.get(data.guildId);
    let members = guild?.members.cache.filter(m => !m.user.bot && m.id !== interaction.user.id);
    if (!guild || !members) return [];

    const joinerIds: string[] = [];
    for (let i = GameManager.rsvpMin; i <= GameManager.rsvpMax; i++) {
      const joinerId = interaction.options.getString(`insert_${slot(i)}`);
      if (!joinerId) continue;
      const joiner = guild.members.cache.get(joinerId);
      if (joiner) joinerIds.push(joiner.id);
    }
    members = members.filter(m => !joinerIds.includes(m.id) && !data.joinersId.includes(m.id));

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

  async removeSlotAutocomplete(interaction: AutocompleteInteraction<CacheType>, value: string) {
    const db = DatabaseFacade.instance();

    const inviteId = interaction.options.getString('game_invite', true);
    const data = await db.gameInviteData(inviteId);
    if (!data) return [];

    const guild = client.guilds.cache.get(data.guildId);
    let members = guild?.members.cache.filter(m => data.joinersId.includes(m.id));
    if (!guild || !members) return [];

    const joinerIds: string[] = [];
    for (let i = GameManager.rsvpMin; i <= GameManager.rsvpMax; i++) {
      const joinerId = interaction.options.getString(`remove_${slot(i)}`);
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
}
