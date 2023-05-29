import {
  signEvent,
  getEventHash,
  getPublicKey,
  nip19,
  nip04,
  verifySignature,
} from 'nostr-tools';

import { secp256k1 } from '@noble/curves/secp256k1'
import { strict as assert } from 'assert';
import { generatePrivateKey } from 'nostr-tools';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { base64 } from '@scure/base'
import { sign } from 'crypto';

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder()

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
    return await nip04.encrypt(this.privKey, pubkey, content);
  }

  async nip04Decrypt(pubkey: string, content: string): Promise<string> {
    return await nip04.decrypt(this.privKey, pubkey, content);
  }

  async nipXXEncrypt(pubkey: string, inner: UnsignedEvent, version: number): Promise<NostrEvent> {
    if (version != 1)
      throw new Error('version not supported');
    const event = await this.signEvent(inner)
    const content = JSON.stringify(event)
    const epriv = generatePrivateKey()
    const epub = getPublicKey(epriv)
    const key = secp256k1.getSharedSecret(epriv, '02' + pubkey)
    const normalizedKey = key.slice(1,33)
    const iv = randomBytes(16)
    const derivedKey = hkdf(sha256, normalizedKey, iv, undefined, 32);
    
    let plaintext = utf8Encoder.encode(content)
    let cryptoKey = await crypto.subtle.importKey(
      'raw',
      derivedKey,
      {name: 'AES-CBC'},
      false,
      ['encrypt']
    )

    let ciphertext = await crypto.subtle.encrypt(
      {name: 'AES-CBC', iv},
      cryptoKey,
      plaintext
    )
    
    let ctb64 = base64.encode(new Uint8Array(ciphertext))
    let ivb64 = base64.encode(new Uint8Array(iv.buffer))
    
    const unsigned = {
      kind: 99,
      content: ctb64 + "?iv=" + ivb64,
      pubkey: epub,
      tags: [["p", pubkey], ["v", JSON.stringify(version)]]
    }
    const signed = await this.signEventWith(unsigned, epriv, epub)
    return signed
  }
 
async nipXXDecrypt(privkey: string, event: NostrEvent): Promise<NostrEvent> {
    const vtag = event.tags.find((t)=>t[0]=="v")
    const version = vtag?JSON.parse(vtag[1]):0
    
    if (version != 1)
      throw new Error('version not supported');

    let key = secp256k1.getSharedSecret(privkey, '02' + event.pubkey)
    const normalizedKey = key.slice(1,33)
    
    let [ctb64, ivb64] = event.content.split('?iv=')

    let iv = base64.decode(ivb64)
    let ciphertext = base64.decode(ctb64)
    const derivedKey = hkdf(sha256, normalizedKey, iv, undefined, 32);

    let cryptoKey = await crypto.subtle.importKey(
      'raw',
      derivedKey,
      {name: 'AES-CBC'},
      false,
      ['decrypt']
    )

    let plaintext = await crypto.subtle.decrypt(
      {name: 'AES-CBC', iv},
      cryptoKey,
      ciphertext
    )

    let text = utf8Decoder.decode(plaintext)

    let message = JSON.parse(text)

    if (!verifySignature(message)) {
      throw Error("unable to verify")
    }
    return message
  }

  async signEvent(event: UnsignedEvent): Promise<NostrEvent> {
    return await this.signEventWith(event, this.privKey, this.pubKey)
  }

  async signEventWith(event: UnsignedEvent, privkey:string, pubkey:string): Promise<NostrEvent> {
    const { kind, tags, content } = event;
    const created_at = Math.floor(Date.now() / 1000);
    const tmp: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: kind,
      tags: tags,
      content: content,
      created_at: created_at,
      pubkey: pubkey,
    };
    const ret: NostrEvent = {
      ...tmp,
      id: getEventHash(tmp),
      sig: signEvent(tmp, privkey),
    };
    return ret as NostrEvent;
  }

  isMine(event: NostrEvent): boolean {
    const { pubkey } = event;
    return pubkey == this.pubKey;
  }
}
