/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter } from 'nostr-tools';
import { NostrPool, NostrEvent } from '.';
import { EncChannel } from './encchannel';
import { Nip28Channel, Nip28ChannelInfo } from './nip28channel'

export interface ChannelInput {
  name: string;
  about: string;
  picture: string;
  is_private: boolean;
}

export interface ChannelInfo extends ChannelInput {
  id: string;
  author: string;
  privkey?: string;
}

export class ChannelManager {
  public pool: NostrPool;
  private _knownChannels: ChannelInfo[] = [];
  enc: EncChannel;
  nip28: Nip28Channel;
  //  private store: SqliteStore;

  constructor(pool: NostrPool) {
    this.pool = pool;
    this.enc = new EncChannel(pool);
    this.nip28 = new Nip28Channel(pool);
  }

  async create(meta: ChannelInput): Promise<ChannelInfo> {
    let ret: ChannelInfo

    if (meta.is_private) {
        const res = await this.enc.createPrivate(meta, [])
        ret = {
          ...meta,
          id: res.pubkey,
          author: this.pool.ident.pubKey,
          privkey: res.privkey
        }
    } else {
        const ev = await this.nip28.create(meta)
        ret = {
          ...meta,
          id: ev.id,
          author: ev.pubkey
        }
    }
    return ret;
  }

  async setMeta(channel_id: string, meta: Nip28ChannelInfo) : Promise<void> {
      if (isPrivateId(channel_id)) {
        await this.enc.setMeta(channel_id, meta) 
      } else {
        await this.nip28.setMeta(channel_id, meta) 
      }
  }

  async getMeta(channel_id: string, privkey?: string, db_only = false): Promise<ChannelInfo> {
      if (privkey) {
        return {is_private: true, ...await this.enc.getMeta({pubkey: channel_id, privkey: privkey})} as ChannelInfo
      } else {
        return {is_private: false, ...await this.nip28.getMeta(channel_id)} as ChannelInfo
      }
  }

  async send(
    channel_id: string,
    content: string,
    replyTo?: string,
    tags: string[][] = []
  ): Promise<NostrEvent> {
    if (isPrivateId(channel_id)) {
        return await this.enc.send(channel_id, content, replyTo, tags)
    } else {
        return await this.nip28.send(channel_id, content, replyTo, tags)
    }
  }

  async delete(event_id: string, tags: string[][] = []): Promise<NostrEvent> {
    return await this.nip28.delete(event_id, tags)
  }

  async sub(
    channel_id: string,
    callback: (ev: NostrEvent) => void,
    filter: Filter = {},
    privkey?: string
  ) {
    if (isPrivateId(channel_id)) {
        if (!privkey) throw Error("private key needed")
        return await this.enc.sub({pubkey: channel_id, privkey: privkey}, callback, filter)
    } else {
        return await this.nip28.sub(channel_id, callback, filter)
    }
  }

  async list(
    channel_id: string,
    filter: Filter = {},
    db_only = false,
    privkey?: string
  ) {
    if (isPrivateId(channel_id)) {
        if (!privkey) throw Error("private key needed")
        return await this.enc.list({pubkey: channel_id, privkey: privkey}, filter, db_only)
    } else {
        return await this.nip28.list(channel_id, filter, db_only)
    }
  }
}

function isPrivateId(channel_id: string) : boolean {
  return channel_id.length < 48
}
