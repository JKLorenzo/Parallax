import { GuildMember, Message, MessageComponentInteraction } from 'discord.js';
import { client } from '../main.js';
import Component from '../structures/component.js';
import { hasAny, parseMention } from '../utils/functions.js';
import { Queuer } from '../utils/queuer.js';

const invites = new Queuer();

export default class GameInvite extends Component {
  constructor() {
    super({
      name: 'game_invite',
      options: [
        {
          type: 'ACTION_ROW',
          components: [
            {
              customId: 'join',
              type: 'BUTTON',
              label: 'Join this bracket',
              style: 'PRIMARY',
              emoji: client.emojis.cache.find(e => e.name === 'blob_game'),
            },
            {
              customId: 'leave',
              type: 'BUTTON',
              label: 'Leave',
              style: 'DANGER',
            },
          ],
        },
      ],
    });
  }

  async exec(interaction: MessageComponentInteraction, customId: string): Promise<unknown> {
    if (!interaction.inGuild()) return false;

    const message = interaction.message as Message;
    const member = interaction.member as GuildMember;
    const embed = message.embeds[0];
    const bracket_name = embed.title;
    const slots = embed.fields.length;
    const isLimited = hasAny(embed.footer?.text ?? '', 'limited');
    const inviterId = parseMention(embed.fields[0].value);
    const inviter = interaction.guild?.members.cache.get(inviterId);
    const players = embed.fields.map(field => field.value).filter(p => p !== 'Slot Available');

    if (inviter?.id === member.id) {
      return interaction.reply({
        content:
          'To cancel this game invite, right click this message and select Cancel Game Invite.',
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    await invites.queue(async () => {
      if (!embed.footer?.text || hasAny(embed.footer.text, 'bracket is now full')) return;

      switch (customId) {
        case 'join':
          if (players.includes(member.toString())) return;
          players.forEach(player => {
            const playerId = parseMention(player);
            interaction.guild?.members.cache
              .get(playerId)
              ?.send(`${member} joined your ${bracket_name} bracket on ${interaction.guild}.`);
          });
          players.push(member.toString());
          break;
        case 'leave':
          if (!players.includes(member.toString())) return;
          players.splice(players.indexOf(member.toString()), 1);
          players.forEach(player => {
            const playerId = parseMention(player);
            interaction.guild?.members.cache
              .get(playerId)
              ?.send(`${member} left your ${bracket_name} bracket.`);
          });
          break;
      }

      if (isLimited) {
        for (let slot = 1; slot < slots; slot++) {
          embed.fields[slot].value = players[slot] ?? 'Slot Available';
        }

        if (players.length === slots) {
          message.components = [];
          embed.setFooter('This limited bracket is now full.');
          players.forEach(player => {
            const playerId = parseMention(player);
            interaction.guild?.members.cache.get(playerId)?.send({
              content: `Your ${bracket_name} bracket is now full.`,
              embeds: [embed],
            });
          });
        }
      } else {
        embed.spliceFields(
          1,
          slots - 1 > 0 ? slots - 1 : 0,
          players
            .filter(p => !hasAny(p, inviter?.id ?? ''))
            .map((value, index) => ({
              name: `Player ${index + 2}:`,
              value: value,
            })),
        );
      }

      await message.edit({
        embeds: [embed],
        components: message.components,
      });
    });
  }
}
