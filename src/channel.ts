/* eslint-disable @typescript-eslint/no-unused-vars */

import { NostrPool, NostrEvent } from '.';

export async function listChannels(pool: NostrPool) {
  // todo: this should only use the store, not go and re-query stuff, being lazy to get things done
  return (await pool.list([{ kinds: [40] }])).map((ent) => {
    return JSON.parse(ent.content);
  });
}

interface ChannelInfo {
  name: string;
  about: string;
  picture: string;
}

class N28Channel {
  private pool: NostrPool;
  private _knownChannels: ChannelInfo[] = [];
  //  private store: SqliteStore;

  constructor(pool: NostrPool) {
    this.pool = pool;
  }

  addEventCallback(callback: (event: NostrEvent) => void): void {
    // should get called by the local store
    throw new Error('not implemented');
  }

  async knownChannels(): Promise<ChannelInfo[]> {
    if (!this._knownChannels) {
      this._knownChannels = await listChannels(this.pool);
    }
    return this._knownChannels;
  }

  async channelExists(name: string) {
    return (await this.knownChannels()).some((ent) => {
      return ent.name == name;
    });
  }
  /*  setStore(store: SqliteStore): void {
    this.store = store;
  }
*/
  async create(meta: ChannelInfo) {
    if (await this.channelExists(meta.name)) {
      throw new Error(`Channel '${meta.name}' already exists.`);
    }
    event: UnsignedEvnt
  }

  async setMeta(meta: ChannelInfo) {
    throw new Error('not implemented yet');
  }

  async getMeta(): Promise<ChannelInfo> {
    throw new Error('not implemented yet');
  }

  async send(message: { content: string; replyTo?: string }): Promise<void> {
    throw new Error('not implemented yet');
  }

  async muteUser(params: { content: string; pubkey: string }): Promise<void> {
    throw new Error('not implemented yet');
  }

  async join(name: string): Promise<void> {
    // should list existing stuff in the channel, and subscribe to future stuff
    throw new Error('not implemented yet');
  }
}

export default N28Channel;
