/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter, matchFilter, nip04 } from 'nostr-tools';
import { NostrPool, NostrEvent, UnsignedEvent, ArcadeIdentity } from '.';

export class PrivateMessageManager {
  private pool: NostrPool;
  //  private store: SqliteStore;

  constructor(pool: NostrPool) {
    this.pool = pool;
  }

  async send(
    pubkey: string,
    content: string,
    replyTo?: string,
    tags: string[][] = []
  ): Promise<NostrEvent> {
    const oth: string[][] = [];
    if (replyTo) {
      oth.push(['e', replyTo, this.pool.relays[0], 'reply']);
    }
    const ev = await this.pool.send({
      kind: 4,
      content: await this.pool.ident.nip04Encrypt(pubkey, content),
      tags: [['p', pubkey], ...oth, ...tags],
    });
    return ev;
  }

  async send44X(
    pubkey: string,
    content: string,
    replyTo?: string,
    tags: string[][] = []
  ): Promise<NostrEvent> {
    const oth: string[][] = [];
    if (replyTo) {
      oth.push(['e', replyTo, this.pool.relays[0], 'reply']);
    }
    const ev = await this.pool.ident.nip44XEncrypt(pubkey, content);
    return await this.pool.sendRaw(ev);
  }

  sub(
    callback: (ev: NostrEvent) => void,
    filter?: Filter,
    eose?: () => Promise<void>,
    pubkey?: string
  ) {
    const filter_ex: Filter<number>[] = this.filter(pubkey);
    console.log('subbing', filter_ex);
    this.pool.sub(
      filter_ex,
      (ev) => {
        if (!filter || matchFilter(filter, ev)) {
          this.decrypt(ev, pubkey).then((got) => {
            if (got) callback(got);
          });
        }
      },
      async () => { await new Promise((res)=>setTimeout(res, 1)); if (eose) await eose() ; }
    );
  }

  async decrypt(evx: NostrEvent, pubkey?: string) {
    let ev = {...evx}
    try {
      if (ev.pubkey != this.pool.ident.pubKey) {
        if (ev.kind == 99) {
          ev = await this.pool.ident.nipXXDecrypt(ev);
        } else {
          if (ev.content.endsWith("??1")) {
            if (!pubkey) {
              console.log("can't decrypt if we don't know the channel")
              throw Error("can't decrypt without channel pubkey")
            }
            ev.content = await this.pool.ident.nip44XDecrypt(
              pubkey,
              ev.content
            );
          } else {
            ev.content = await this.pool.ident.nip04Decrypt(
              ev.pubkey,
              ev.content
            );
          }
       }
      } else {
        const pubkey = ev.tags.find((t) => t[0] == 'p')?.[1] as string;
        ev.content = await nip04.decrypt(
          this.pool.ident.privKey,
          pubkey,
          ev.content
        );
      }
      return ev.content ? ev : null;
    } catch (e) {
      // can't decrypt, probably spam or whatever
      console.log("can't decrypt from", evx.pubkey)
      return null;
    }
  }

  async list(
    filter?: Filter,
    db_only = false,
    pubkey?: string,
    callback?: (ev:NostrEvent)=>Promise<void>
  ): Promise<NostrEvent[]> {
    const filter_ex: Filter<number>[] = this.filter(pubkey);
    let cb = callback
    if (callback) {
        cb = async (ev:NostrEvent)=>{const evx = await this.decrypt(ev, pubkey); if (evx) {await callback(evx)}}
    }
    const lst = await this.pool.list(filter_ex, db_only, cb, callback);
    const mapped = await Promise.all(
      lst.map(async (ev: NostrEvent) => {
        return (!filter || matchFilter(filter, ev)) ? await this.decrypt(ev, pubkey) : null;
      })
    );

    return mapped.filter((ev: NostrEvent | null) => {
      return ev != null;
    }) as NostrEvent[];
  }

  public filter(pubkey?: string) {
    const filter_ex: Filter<number>[] = [
      { kinds: [4], '#p': [this.pool.ident.pubKey] },
    ];
    if (pubkey) {
      const tmpId = this.pool.ident.nip44XIdent(pubkey)
      filter_ex[0].authors = [pubkey, tmpId.pubKey]

      filter_ex.push({
        kinds: [4],
        authors: [this.pool.ident.pubKey, tmpId.pubKey],
        '#p': [pubkey],
      });
    }
    return filter_ex;
  }
}
