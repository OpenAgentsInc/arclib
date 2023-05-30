/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter, generatePrivateKey, getPublicKey } from 'nostr-tools';
import { NostrPool, NostrEvent, ArcadeIdentity } from '.';
import {ChannelInfo} from './channel'
import { nsecEncode } from 'nostr-tools/lib/nip19';

interface EncChannelInfo extends ChannelInfo {
  ident: ArcadeIdentity;
  privkey: string
  pubkey?: string
}

class EncChannel {
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

  async getChannel(name: string): Promise<EncChannelInfo | null> {
    const ret = (await this.knownChannels()).filter((ent) => {
      return ent.name == name;
    })[0];
    return ret ?? null;
  }

  async createPrivate(meta: ChannelInfo, member_pubkeys: string[]): Promise<string> {
    const epriv = generatePrivateKey()
    const epub = getPublicKey(epriv)
    const set = new Set(member_pubkeys)
    set.add(this.pool.ident.pubKey)
    const xmeta: EncChannelInfo = {privkey: epriv, ...meta}
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
    return epub;
  }

  async setMeta(meta: ChannelInfo) {
    throw new Error('not implemented yet');
  }

  async getMeta(): Promise<ChannelInfo> {
    throw new Error('not implemented yet');
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

    const inner = {
      kind: 402,
      content: content,
      tags: [['e', channel_pubkey, this.pool.relays[0], 'root'], ...oth, ...tags],
    }
    
    const enc = await this.pool.ident.nipXXEncrypt(channel_pubkey, inner, 1)
      
    const ev = await this.pool.sendRaw(enc)

    return ev;
  }

  async sub(
    channel_pubkey: string,
    callback: (ev: NostrEvent) => void,
    filter: Filter = {}
  ) {
    if (!channel_pubkey) throw new Error('channel id is required');
    return this.pool.sub(
      [{ kinds: [99], authors: [channel_pubkey], ...filter }],
      callback
    );
  }

  async list(
    channel: EncChannelInfo,
    filter: Filter = {},
    db_only = false
  ): Promise<NostrEvent[]> {
    if (!channel.pubkey) {
      channel.pubkey = getPublicKey(channel.privkey)
      const nsec = nsecEncode(channel.privkey)
      channel.ident = new ArcadeIdentity(nsec)
    }
    const lst = await this.pool.list(
      [{ kinds: [99], authors: [channel.pubkey], ...filter }],
      db_only
    );

    const map = await Promise.all(lst.map(async (ev)=>{
        return await channel.ident.nipXXDecrypt(ev)
    }))
    return map.filter(ev=>ev!=null)
  }

  async muteUser(params: { content: string; pubkey: string }): Promise<void> {
    throw new Error('not implemented yet');
  }
}

export default EncChannel;
