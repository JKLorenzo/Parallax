import {
  Colors,
  ContainerBuilder,
  MessageFlags,
  type GuildMember,
  type VoiceBasedChannel,
} from 'discord.js';

export default class VoiceChannelOperator {
  static async onMemberJoin(member: GuildMember, channel: VoiceBasedChannel) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents(builder => builder.setContent(`${member} joined the channel.`))
      .setAccentColor(Colors.Green);

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
      allowedMentions: { parse: [] },
    });
  }

  static async onMemberLeave(member: GuildMember, channel: VoiceBasedChannel) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents(builder => builder.setContent(`${member} left the channel.`))
      .setAccentColor(Colors.Fuchsia);

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
      allowedMentions: { parse: [] },
    });
  }
}
