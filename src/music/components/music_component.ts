import {
  ComponentType,
  ButtonStyle,
  MessageComponentInteraction,
  type ActionRowData,
  type CacheType,
  type MessageActionRowComponentData,
  type BaseMessageOptions,
} from 'discord.js';
import { findEmoji } from '../../main.js';
import MusicManager from '../music_manager.js';
import { Component } from '../../interaction/modules/component.js';

enum Id {
  PausePlay = 'pauseplay',
  Skip = 'skip',
  Stop = 'stop',
  List = 'list',
  Disconnect = 'disconnect',
}

export default class MusicComponent extends Component {
  static data(): ActionRowData<MessageActionRowComponentData>[] {
    return [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            customId: this.makeId(Id.PausePlay),
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            emoji: findEmoji('pauseplay'),
          },
          {
            customId: this.makeId(Id.Skip),
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            emoji: findEmoji('skip'),
          },
          {
            customId: this.makeId(Id.Stop),
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            emoji: findEmoji('stop'),
          },
          {
            customId: this.makeId(Id.List),
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            emoji: findEmoji('queue'),
          },
          {
            customId: this.makeId(Id.Disconnect),
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            emoji: findEmoji('power'),
          },
        ],
      },
    ];
  }

  async exec(interaction: MessageComponentInteraction<CacheType>, customId: Id) {
    const manager = MusicManager.instance();
    const user = interaction.user;

    await interaction.deferReply();

    let result: BaseMessageOptions;

    switch (customId) {
      case Id.PausePlay: {
        result = await manager.pauseplay({ user });
        break;
      }
      case Id.Skip: {
        result = await manager.skipTracks({ user });
        break;
      }
      case Id.Stop: {
        result = await manager.stop({ user });
        break;
      }
      case Id.List: {
        result = await manager.list({ user });
        break;
      }
      case Id.Disconnect: {
        result = await manager.disconnect({ user });
        break;
      }
      default: {
        result = { content: `Unknown component \`${customId}\`.` };
      }
    }

    await interaction.editReply(result);
  }
}
