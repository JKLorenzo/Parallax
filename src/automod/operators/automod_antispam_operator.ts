import { Colors, ContainerBuilder, MessageFlags, type Message, type Snowflake } from 'discord.js';
import { AutoModComponents, Constants } from '../../misc/constants.js';
import Queuer from '../../modules/queuer.js';

export default class AutomodAntiSpamOperator {
  private messages: Message[];
  private userQueuer: Map<Snowflake, Queuer>;

  constructor() {
    this.messages = [];
    this.userQueuer = new Map();
  }

  register(message: Message) {
    if (!message.inGuild() || message.author.bot) return;

    const queuer = this.userQueuer.get(message.author.id) ?? new Queuer();

    queuer.queue(async () => {
      await this.spamProtection(message);

      this.messages.push(message);
      setTimeout(() => {
        this.messages.pop();
      }, 10000);
    });

    this.userQueuer.set(message.author.id, queuer);
  }

  private async spamProtection(message: Message<true>) {
    const me = message.guild.members.me;
    if (!me?.permissions.has('ModerateMembers')) return;

    let member = message.guild.members.cache.get(message.author.id);
    if (!member?.moderatable) return;

    const messages = this.messages.filter(m => m.author.id === member.id && m.id !== message.id);
    const spamMessages = messages.filter(m => m.content === message.content);
    if (spamMessages.length === 0) return;
    spamMessages.push(message);

    const safetyChannel = member.guild.safetyAlertsChannel ?? member.guild.systemChannel;

    if (!member.isCommunicationDisabled()) {
      const timedoutMember = await member.timeout(
        Constants.AUTOMOD_TIMEOUT_MINS * 60000,
        Constants.AUTOMOD_MANAGER_TITLE,
      );
      const communicationDisabledUntil = timedoutMember.communicationDisabledUntil;

      const detectMessage = new ContainerBuilder({ id: AutoModComponents.AUTOMOD_CONTAINER })
        .addTextDisplayComponents(b =>
          b.setContent(
            [
              '### AutoMod AntiSpam Protection',
              '## Spam Detected!',
              `-# User timeout and automated purging initiated.`,
            ].join('\n'),
          ),
        )
        .addTextDisplayComponents(b => b.setContent('### Offender'))
        .addTextDisplayComponents(b =>
          b.setId(AutoModComponents.AUTOMOD_OFFENDER).setContent(member!.toString()),
        )
        .addTextDisplayComponents(b => b.setContent('### Evidence'))
        .addTextDisplayComponents(b =>
          b.setId(AutoModComponents.AUTOMOD_EVIDENCE).setContent(`\`${message.content}\``),
        )
        .setAccentColor(Colors.Red);

      const actionMessage = new ContainerBuilder()
        .addTextDisplayComponents(b =>
          b.setContent(['### AutoMod AntiSpam Protection', '**User Timeout**'].join('\n')),
        )
        .addTextDisplayComponents(b =>
          b.setContent(
            [
              `-# **Offender**: ${member.toString()}`,
              `-# **Communication Disabled Until**: ${communicationDisabledUntil?.toLocaleString()}`,
            ].join('\n'),
          ),
        )
        .setAccentColor(Colors.Fuchsia);

      await safetyChannel?.send({
        components: [detectMessage, actionMessage],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      });
    }

    for (const spam of spamMessages) {
      if (!spam.deletable) continue;

      try {
        const actionMessage = new ContainerBuilder()
          .addTextDisplayComponents(b =>
            b.setContent(['### AutoMod AntiSpam Protection', '**Automated Purging**'].join('\n')),
          )
          .addTextDisplayComponents(b =>
            b.setContent(
              [
                `-# **Offender**: ${member.toString()}`,
                `-# **Channel**: ${spam.channel}`,
                `-# **Message Id**: ${spam.id}`,
              ].join('\n'),
            ),
          )
          .setAccentColor(Colors.Fuchsia);

        const channelMessage = new ContainerBuilder()
          .addTextDisplayComponents(b =>
            b.setContent(
              [
                '### AutoMod AntiSpam Protection',
                `Action taken for a message sent by ${member}.`,
              ].join('\n'),
            ),
          )
          .setAccentColor(Colors.Fuchsia);

        await spam.delete().then(() => {
          safetyChannel?.send({ components: [actionMessage], flags: MessageFlags.IsComponentsV2 });

          if (spam.channel.isSendable()) {
            spam.channel.send({
              components: [channelMessage],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
              allowedMentions: { parse: [] },
            });
          }
        });
      } catch (_) {}
    }
  }
}
