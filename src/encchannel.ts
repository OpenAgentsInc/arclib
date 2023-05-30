/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter, generatePrivateKey, getPublicKey } from 'nostr-tools';
import { NostrPool, NostrEvent, ArcadeIdentity } from '.';
import {ChannelInfo} from './channel'
import { nip19 } from 'nostr-tools';

interface EncChannelInfo extends ChannelInfo {
  privkey: string
  pubkey?: string
  ident?: ArcadeIdentity;
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

  async createPrivate(meta: ChannelInfo, member_pubkeys: string[]): Promise<EncChannelInfo> {
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
    return xmeta;
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
    const epriv = generatePrivateKey()
    const tmp_ident = new ArcadeIdentity(epriv) 
    const message = {
      kind: 402,
      content: await this.pool.ident.nip04XEncrypt(epriv, channel_pubkey, content, 1),
      tags: [['p', channel_pubkey]]
    }
    const ev = tmp_ident.signEvent(message)
    return ev;
  }

  async sub(
    channel_pubkey: string,
    callback: (ev: NostrEvent) => void,
    filter: Filter = {}
  ) {
    if (!channel_pubkey) throw new Error('channel id is required');
    return this.pool.sub(
      [{ kinds: [402], "#p": [channel_pubkey], ...filter }],
      callback
    );
  }

  augmentChannelInfo(channel: EncChannelInfo) {
    if (!channel.pubkey) {
      channel.pubkey = getPublicKey(channel.privkey)
      const nsec = nip19.nsecEncode(channel.privkey)
      channel.ident = new ArcadeIdentity(nsec)
    }
  }

  async list(
    channel: EncChannelInfo,
    filter: Filter = {},
    db_only = false
  ): Promise<NostrEvent[]> {
    this.augmentChannelInfo(channel)
    console.log("looking for channel: ", channel.pubkey)
    
    const lst = await this.pool.list(
      [{ kinds: [402], "#p": [channel.pubkey as string], ...filter }],
      db_only
    );

    const map = await Promise.all(lst.map(async (ev)=>{
        return await channel.ident?.nipXXDecrypt(ev)
    }))
    return map.filter(ev=>ev!=null) as NostrEvent[]
  }

  async muteUser(params: { content: string; pubkey: string }): Promise<void> {
    throw new Error('not implemented yet');
  }
}

export default EncChannel;
