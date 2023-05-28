/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter } from 'nostr-tools';
import { NostrPool, NostrEvent } from '.';

export async function listChannels(pool: NostrPool): Promise<ChannelInfo[]> {
  // todo: this should only use the store, not go and re-query stuff, being lazy to get things done
  return (await pool.list([{ kinds: [40] }])).map((ent) => {
    return { ...JSON.parse(ent.content), id: ent.id, author: ent.pubkey };
  });
}

interface ChannelInfo {
  name: string;
  about: string;
  picture: string;
  id?: string;
  author?: string;
}

class Nip28Channel {
  public pool: NostrPool;
  private _knownChannels: ChannelInfo[] = [];
  //  private store: SqliteStore;

  constructor(pool: NostrPool) {
    this.pool = pool;
  }

  addEventCallback(callback: (event: NostrEvent) => void): void {
    // should get called by the local store
    throw new Error('not implemented');
  }

  async knownChannels(force?: boolean): Promise<ChannelInfo[]> {
    if (!this._knownChannels || force) {
      this._knownChannels = await listChannels(this.pool);
    }
    return this._knownChannels;
  }

  async getChannel(name: string): Promise<ChannelInfo | null> {
    const ret = (await this.knownChannels()).filter((ent: ChannelInfo) => {
      return ent.name==name;
    })[0];
    return ret ?? null;
  }

  async create(meta: ChannelInfo): Promise<NostrEvent> {
    if (await this.getChannel(meta.name)) {
      throw new Error(`A channel with name '${meta.name}' already exists.`);
    }
    const ev = await this.pool.send({
      kind: 40,
      content: JSON.stringify(meta),
      tags: [['d', meta.name]],
    });
    this._knownChannels.push({ ...meta, id: ev.id, author: ev.pubkey });
    return ev;
  }

  async setMeta(meta: ChannelInfo) {
    throw new Error('not implemented yet');
  }

  async getMeta(): Promise<ChannelInfo> {
    throw new Error('not implemented yet');
  }

  async send(
    channel_id: string,
    content: string,
    replyTo?: string,
    tags: string[][] = []
  ): Promise<NostrEvent> {
    if (!channel_id) throw new Error('channel id is required');
    const oth: string[][] = [];
    if (replyTo) {
      oth.push(['e', replyTo, this.pool.relays[0], 'reply']);
    }
    const ev = await this.pool.send({
      kind: 42,
      content: content,
      tags: [['e', channel_id, this.pool.relays[0], 'root'], ...oth, ...tags],
    });
    return ev;
  }

  async delete(event_id: string, tags: string[][] = []): Promise<NostrEvent> {
    if (!event_id) throw new Error('event id is required');
    const ev = await this.pool.send({
      kind: 5,
      content: '',
      tags: [['e', event_id]],
    });
    return ev;
  }

  async sub(channel_id: string, callback: (ev: NostrEvent)=>void, filter: Filter={}) {
    if (!channel_id) throw new Error('channel id is required');
    return this.pool.sub([{ kinds: [42], '#e': [channel_id], ...filter }], callback);
  }

  async list(channel_id: string, filter: Filter = {}, db_only=false): Promise<NostrEvent[]> {
    if (!channel_id) throw new Error('channel id is required');
    return this.pool.list([{ kinds: [42], '#e': [channel_id], ...filter }], db_only);
  }

  async muteUser(params: { content: string; pubkey: string }): Promise<void> {
    throw new Error('not implemented yet');
  }
}

export default Nip28Channel;
