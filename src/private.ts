/* eslint-disable @typescript-eslint/no-unused-vars */

import { Filter, matchFilter, nip04 } from 'nostr-tools';
import { NostrPool, NostrEvent, UnsignedEvent } from '.';

export async function listChannels(
  pool: NostrPool,
  db_only = false
): Promise<ChannelInfo[]> {
  // todo: this should only use the store, not go and re-query stuff, being lazy to get things done
  return (await pool.list([{ kinds: [40] }], db_only)).map((ent) => {
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

  async sendXX(
    pubkey: string,
    content: UnsignedEvent,
    version = 1
  ): Promise<NostrEvent> {
    const ev = await this.pool.ident.nipXXEncrypt(pubkey, content, version);
    return await this.pool.sendRaw(ev);
  }

  sub(
    callback: (ev: NostrEvent) => void,
    filter: Filter = {},
    eose?: () => Promise<void>,
    pubkey?: string
  ) {
    const filter_ex: Filter<number>[] = this.filter(pubkey);
    console.log('subbing');
    this.pool.sub(
      filter_ex,
      (ev) => {
        console.log('ev is here', ev);
        if (matchFilter(filter, ev)) {
          this.decrypt(ev).then((got) => {
            if (got) callback(got);
          });
        }
      },
      eose
    );
  }

  async decrypt(ev: NostrEvent) {
    try {
      if (ev.pubkey != this.pool.ident.pubKey) {
        if (ev.kind == 99) {
          console.log('decrypt ev', ev);
          ev = await this.pool.ident.nipXXDecrypt(ev);
        } else {
          console.log('decrypt dm', ev);
          ev.content = await this.pool.ident.nip04Decrypt(
            ev.pubkey,
            ev.content
          );
        }
      } else {
        console.log('decrypt nip4', ev);
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
      return null;
    }
  }

  async list(
    filter: Filter = {},
    db_only = false,
    pubkey?: string
  ): Promise<NostrEvent[]> {
    const filter_ex: Filter<number>[] = this.filter(pubkey);
    const lst = await this.pool.list(filter_ex, db_only);
    const mapped = await Promise.all(
      lst.map(async (ev: NostrEvent) => {
        return matchFilter(filter, ev) ? await this.decrypt(ev) : null;
      })
    );

    return mapped.filter((ev: NostrEvent | null) => {
      return ev != null;
    }) as NostrEvent[];
  }

  public filter(pubkey?: string) {
    const filter_ex: Filter<number>[] = [
      { kinds: [4, 99], '#p': [this.pool.ident.pubKey] },
    ];
    if (pubkey) {
      filter_ex.push({
        kinds: [4],
        authors: [this.pool.ident.pubKey],
        '#p': [pubkey],
      });
    }
    return filter_ex;
  }
}
