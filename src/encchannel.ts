/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter, generatePrivateKey, getPublicKey } from 'nostr-tools';
import { NostrPool, NostrEvent, ArcadeIdentity } from '.';
import { Nip28ChannelInfo } from './nip28channel'

export interface EncChannelInfo extends Nip28ChannelInfo {
  id: string
  privkey: string
}

export class EncChannel {
  public pool: NostrPool;
  private _knownChannels: EncChannelInfo[] = [];
  //  private store: SqliteStore;

  constructor(pool: NostrPool) {
    this.pool = pool;
  }

  addEventCallback(callback: (event: NostrEvent) => void): void {
    // should get called by the local store
    throw new Error('not implemented');
  }

  async listChannels(db_only?: boolean): Promise<EncChannelInfo[]> {
    const filt = {
      kinds: [99],
      "#p": [this.pool.ident.pubKey]
    }
    const map = await Promise.all((await this.pool.list([filt], db_only)).map(async (ev)=>{
      const inner = await this.pool.ident.nipXXDecrypt(ev)
      if (inner.kind == 400) {
        const chinfo: EncChannelInfo = JSON.parse(inner.content)
        chinfo.id = getPublicKey(chinfo.privkey)
        return chinfo
      }
      return null
    }))

    const fin = map.filter(ent=>ent != null) as EncChannelInfo[]
    return fin
  }

  async knownChannels(force?: boolean): Promise<EncChannelInfo[]> {
    if (!this._knownChannels || force) {
      this._knownChannels = await this.listChannels();
    }
    return this._knownChannels;
  }

  async getChannelByName(name: string, db_only = false): Promise<EncChannelInfo | null> {
    return (await this.listChannels(db_only)).filter(ev=>ev.name==name)[0]
  }

  async getChannelById(channel_pubkey: string, db_only = false): Promise<EncChannelInfo | null> {
    return (await this.listChannels(db_only)).filter(ch=>ch.id==channel_pubkey)[0]
  }

  async createPrivate(meta: Nip28ChannelInfo, member_pubkeys: string[]): Promise<EncChannelInfo> {
    const epriv = generatePrivateKey()
    const epub = getPublicKey(epriv)
    const set = new Set(member_pubkeys)
    set.add(this.pool.ident.pubKey)
    const xmeta: EncChannelInfo = {privkey: epriv, ...meta, id: epub, author: this.pool.ident.pubKey}
    await Promise.all(Array.from(set).map(async (pubkey)=>{
      const inner =  {
        kind: 400,
        content: JSON.stringify(xmeta),
        tags: []
      }
      const enc = await this.pool.ident.nipXXEncrypt(pubkey, inner, 1)
      await this.pool.sendRaw(enc)
    }))

    this._knownChannels.push({ ...meta, id: epub, author: this.pool.ident.pubKey, privkey: epriv });
    return xmeta;
  }

  async setMeta(channel_pubkey: string, meta: Nip28ChannelInfo) {
    const epriv = generatePrivateKey()
    const tmp_ident = new ArcadeIdentity(epriv) 
    const message = {
      kind: 403,
      content: await this.pool.ident.nip04XEncrypt(epriv, channel_pubkey, JSON.stringify(meta), 1),
      tags: [['p', channel_pubkey]]
    }
    const ev = await tmp_ident.signEvent(message)
    return await this.pool.sendRaw(ev);
  }

  async getMeta(info: {id: string, privkey: string, db_only?: boolean}): Promise<Nip28ChannelInfo> {
    const lst = await this.pool.list(
      [{ kinds: [403], "#p": [info.id as string] }],
      info.db_only
    );
    const map = await Promise.all(lst.map(async (ev) => {
      console.log("decrypting", info, ev)
      return await this.decrypt(info, ev);
    }));
    const filt = map.filter((ev) => ev != null)
    const red = filt.length ? filt.reduce((_acc, curr) => {
      return curr;
    }) : null;
    if (!red)
      throw Error("no meta")
    return JSON.parse(red.content)
  }

  async send(
    channel_pubkey: string,
    content: string,
    replyTo?: string,
    tags: string[][] = []
  ): Promise<NostrEvent> {
    if (!channel_pubkey) throw new Error('channel id is required');
    const oth: string[][] = [];
    
    if (replyTo) {
      oth.push(['e', replyTo, this.pool.relays[0], 'reply']);
    }
    const epriv = generatePrivateKey()
    const tmp_ident = new ArcadeIdentity(epriv) 
    const message = {
      kind: 402,
      content: await this.pool.ident.nip04XEncrypt(epriv, channel_pubkey, content, 1),
      tags: [['p', channel_pubkey]]
    }
    const ev = await tmp_ident.signEvent(message)
    return await this.pool.sendRaw(ev);
  }

  async sub(
    channel: {id: string, privkey:string},
    callback: (ev: NostrEvent) => void,
    filter: Filter = {}
  ) {
    if (!channel.id) throw new Error('channel id is required');
    return this.pool.sub(
      [{ kinds: [402], "#p": [channel.id], ...filter }],
      async (ev) => {
        const dec = await this.decrypt(channel, ev)
        if (dec)
          callback(dec)
      }
    );
  }

  async decrypt(channel: {id: string, privkey: string}, ev: NostrEvent): Promise<NostrEvent | null> {
      const ident = new ArcadeIdentity(channel.privkey)
      try {
        const dec = await ident.nip04XDecrypt(channel.privkey, ev.pubkey, ev.content)
        if (dec) {
          ev.content = dec
          return ev
        } else {
          return null
        }
      } catch (e) {
        console.log("decrypt fail", e)
        return null
      }
  }

  async list(
    channel: {id: string, privkey:string},
    filter: Filter = {},
    db_only = false
  ): Promise<NostrEvent[]> {
    if (!channel.id) throw new Error('channel id is required');
    
    const lst = await this.pool.list(
      [{ kinds: [402], "#p": [channel.id], ...filter }],
      db_only
    );

    const map = await Promise.all(lst.map(async (ev)=>{return await this.decrypt(channel, ev)}))

    return map.filter(ev=>ev!=null) as NostrEvent[]
  }

  async muteUser(params: { content: string; pubkey: string }): Promise<void> {
    throw new Error('not implemented yet');
  }
}

export default EncChannel;
