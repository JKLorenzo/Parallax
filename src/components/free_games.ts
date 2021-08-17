import { GuildMember, MessageComponentInteraction, Role } from 'discord.js';
import { client } from '../main.js';
import { getFreeGameConfig } from '../modules/database.js';
import { addRole, removeRole } from '../modules/role.js';
import Component from '../structures/component.js';

export default class FreeGames extends Component {
  constructor() {
    super({
      name: 'free_games',
      options: [
        {
          type: 'ACTION_ROW',
          components: [
            {
              customId: 'steam',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'steam'),
            },
            {
              customId: 'epic',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'epic'),
            },
            {
              customId: 'gog',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'gog'),
            },
            {
              customId: 'ps',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'ps'),
            },
            {
              customId: 'xbox',
              type: 'BUTTON',
              style: 'SECONDARY',
              emoji: client.emojis.cache.find(e => e.name === 'xbox'),
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: MessageComponentInteraction, customId: string): Promise<unknown> {
    if (!interaction.inGuild()) return;

    const guild = interaction.guild!;
    const member = interaction.member as GuildMember;

    await interaction.deferReply({ ephemeral: true });

    const config = await getFreeGameConfig(interaction.guildId);

    let role: Role | undefined;
    switch (customId) {
      case 'steam':
        if (config?.steam_role) role = guild.roles.cache.get(config.steam_role);
        break;
      case 'epic':
        if (config?.epic_role) role = guild.roles.cache.get(config.epic_role);
        break;
      case 'gog':
        if (config?.gog_role) role = guild.roles.cache.get(config.gog_role);
        break;
      case 'ps':
        if (config?.ps_role) role = guild.roles.cache.get(config.ps_role);
        break;
      case 'xbox':
        if (config?.xbox_role) role = guild.roles.cache.get(config.xbox_role);
        break;
    }

    if (!role) return interaction.editReply('The role for this platform no longer exist.');
    if (role.id === guild.roles.everyone.id || role.managed) {
      return interaction.editReply('The role for this platform is not assignable.');
    }

    if (member.roles.cache.has(role.id)) {
      await removeRole(member, role);
      await interaction.editReply(`You successfully unsubscribed to ${role} free game updates.`);
    } else {
      await addRole(member, role);
      await interaction.editReply(`You successfully subscribed to ${role} free game updates.`);
    }
  }
}
