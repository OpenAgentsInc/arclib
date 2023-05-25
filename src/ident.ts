import { signEvent, getEventHash, getPublicKey, nip19, nip04 } from 'nostr-tools';

import { strict as assert } from 'assert';
import { generatePrivateKey } from 'nostr-tools';

export interface NostrEvent {
  id: string;
  kind: number;
  pubkey: string;
  tags: string[][];
  content: string;
  sig: string;
  created_at: number;
}

export type UnsignedEvent = Omit<
  NostrEvent,
  'id' | 'sig' | 'created_at' | 'pubkey'
>;

export class ArcadeIdentity {
  public privKey: string;
  public pubKey: string;

  constructor(
    public nsec: string,
    public bitcoinAddress: string = '',
    public lnUrl: string = ''
  ) {
    this.nsec = nsec;
    const { type, data } = nip19.decode(nsec);
    this.privKey = <string>data;
    assert(type == 'nsec');
    this.bitcoinAddress = bitcoinAddress;
    this.lnUrl = lnUrl;
    this.pubKey = getPublicKey(this.privKey);
  }

  static generate() {
    const priv = generatePrivateKey();
    const nsec = nip19.nsecEncode(priv);
    return new ArcadeIdentity(nsec);
  }

  async nip04Encrypt(pubkey: string, content: string): Promise<string> {
    return await nip04.encrypt(this.privKey, pubkey, content)
  }

  async nip04Decrypt(pubkey: string, content: string): Promise<string> {
    return await nip04.decrypt(this.privKey, pubkey, content)
  }

  async signEvent(event: UnsignedEvent): Promise<NostrEvent> {
    const { kind, tags, content } = event;
    const created_at = Math.floor(Date.now() / 1000);
    const tmp: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: kind,
      tags: tags,
      content: content,
      created_at: created_at,
      pubkey: this.pubKey,
    };
    const ret: NostrEvent = {
      ...tmp,
      id: getEventHash(tmp),
      sig: signEvent(tmp, this.privKey),
    };
    return ret as NostrEvent;
  }

  isMine(event: NostrEvent): boolean {
    const { pubkey } = event;
    return pubkey == this.pubKey;
  }
}
