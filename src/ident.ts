import {
  signEvent,
  getEventHash,
  getPublicKey,
  nip19,
} from 'nostr-tools';

import { strict as assert } from 'assert';

export interface NostrEvent {
  id: string;
  kind: number;
  pubkey: string;
  tags: string[];
  content: string;
  sig: string;
  created_at: number;
}

export class ArcadeIdentity {
  public privKey: string;
  public pubKey: string;

  constructor(
    public nsec: string,
    public bitcoinAddress: string,
    public lnUrl: string
  ) {
    this.nsec = nsec;
    const { type, data } = nip19.decode(nsec);
    this.privKey = data;
    assert(type == 'nsec');
    this.bitcoinAddress = bitcoinAddress;
    this.lnUrl = lnUrl;
    this.pubKey = getPublicKey(this.privKey);
  }

  async signEvent(
    event: Omit<NostrEvent, 'id' | 'sig' | 'created_at' | 'pubkey'>,
  ): Promise<NostrEvent> {
    const { kind, tags, content } = event;
    const created_at = Math.floor(Date.now() / 1000);
    const ret: NostrEvent = {
      kind: kind,
      tags: tags,
      content: content,
      created_at: created_at,
      id: '',
      sig: '',
      pubkey: '',
    };
    ret.pubkey = this.pubKey;
    ret.id = getEventHash(ret);
    ret.sig = signEvent(ret, this.privKey);
    return ret;
  }

  isMine(event: NostrEvent): boolean {
    const { pubkey } = event;
    return pubkey == this.pubKey;
  }
}
