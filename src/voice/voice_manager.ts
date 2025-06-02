import type { VoiceState } from 'discord.js';
import { client } from '../main.js';
import Manager from '../modules/manager.js';
import Queuer from '../modules/queuer.js';
import VoiceChannelOperator from './operators/voice_channel_operator.js';

export default class VoiceManager extends Manager {
  private static _instance: VoiceManager;
  private queuer: Queuer;

  constructor() {
    super();

    this.queuer = new Queuer();
  }

  static instance() {
    if (!this._instance) {
      this._instance = new VoiceManager();
    }

    return this._instance;
  }

  init() {
    client.on('voiceStateUpdate', (oldState, newState) => {
      this.queuer.queue(() => this.onVoiceStateUpdate(oldState, newState));
    });
  }

  private onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member ?? oldState.member;
    if (!member) return;

    // Ignore same channel
    if (newState.channelId === oldState.channelId) return;

    // Leave
    if (oldState.channel) {
      VoiceChannelOperator.onMemberLeave(member, oldState.channel);
    }

    // Join
    if (newState.channel) {
      VoiceChannelOperator.onMemberJoin(member, newState.channel);
    }
  }
}
