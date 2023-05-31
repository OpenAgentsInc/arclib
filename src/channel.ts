/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter } from 'nostr-tools';
import { NostrPool, NostrEvent } from '.';
import { EncChannel } from './encchannel';
import { Nip28Channel, Nip28ChannelInfo, listChannels } from './nip28channel'

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
          id: res.id,
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

  async setMeta(channel_id: string, is_private: boolean, meta: Nip28ChannelInfo) : Promise<void> {
      if (is_private) {
        await this.enc.setMeta(channel_id, meta) 
      } else {
        await this.nip28.setMeta(channel_id, meta) 
      }
  }

  async getMeta(channel_id: string, privkey?: string, db_only = false): Promise<ChannelInfo> {
      if (privkey) {
        return {is_private: true, ...await this.enc.getMeta({id: channel_id, privkey: privkey})} as ChannelInfo
      } else {
        return {is_private: false, ...await this.nip28.getMeta(channel_id)} as ChannelInfo
      }
  }

  async send(
    args: {
    channel_id: string,
    content: string,
    replyTo?: string,
    tags?: string[][],
    is_private?: boolean
    }
  ): Promise<NostrEvent> {
    if (args.is_private){
        return await this.enc.send(args.channel_id, args.content, args.replyTo, args.tags)
    } else {
        return await this.nip28.send(args.channel_id, args.content, args.replyTo, args.tags)
    }
  }

  async delete(event_id: string, tags: string[][] = []): Promise<NostrEvent> {
    return await this.nip28.delete(event_id, tags)
  }

  async sub(
    info: {
      channel_id: string,
      callback: (ev: NostrEvent) => void,
      filter?: Filter,
      privkey?: string
    }
  ) {
    if (info.privkey) {
        return await this.enc.sub({id: info.channel_id, privkey: info.privkey}, info.callback, info.filter)
    } else {
        return await this.nip28.sub(info.channel_id, info.callback, info.filter)
    }
  }

  async listChannels(db_only?: boolean) : Promise<ChannelInfo[]> {
    let ret: ChannelInfo[]
    const enc = await this.enc.listChannels(db_only)
    console.log("got encrypted", enc)
    ret = enc.map(el=>({is_private: true, id: el.id, name: el.name, about: el.about, picture: el.picture, author: el.author as string}))
    const pub = await listChannels(this.pool, db_only)
    ret.concat(pub.map(el=>({is_private: false, ...el} as ChannelInfo)))
    return ret 
  }

  async list(
    info: {
      channel_id: string,
      filter?: Filter,
      db_only?: boolean,
      privkey?: string
    }
  ) : Promise<NostrEvent[]> {
    if (info.privkey) {
        return await this.enc.list({id: info.channel_id, privkey: info.privkey}, info.filter, info.db_only)
    } else {
        return await this.nip28.list(info.channel_id, info.filter, info.db_only)
    }
  }
}
