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

  async nip04XEncrypt(privkey: string, pubkey: string, content: string, version: number, iv?: Uint8Array) : Promise<string> {
    const key = secp256k1.getSharedSecret(privkey, '02' + pubkey)
    const normalizedKey = key.slice(1,33)
    iv = iv??randomBytes(16)
    const derivedKey = hkdf(sha256, normalizedKey, iv, undefined, 32);
    
    const plaintext = utf8Encoder.encode(content)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      derivedKey,
      {name: 'AES-GCM'},
      false,
      ['encrypt']
    )

    const ciphertext = await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv},
      cryptoKey,
      plaintext
    )

    const ctb64 = base64.encode(new Uint8Array(ciphertext))
    const ivb64 = base64.encode(new Uint8Array(iv.buffer))
   
    return ctb64 + "??" + ivb64 + "??" + version.toString()
  }
 
async nip04XDecrypt(privkey: string, pubkey: string, data: string): Promise<string> {
    const [ctb64, ivb64, version] = data.split('??')
    if (version != "1")
      throw Error("unknown version")

    const iv = base64.decode(ivb64)
    const ciphertext = base64.decode(ctb64)
    const key = secp256k1.getSharedSecret(privkey, '02' + pubkey)
    const normalizedKey = key.slice(1,33)

    const derivedKey = hkdf(sha256, normalizedKey, iv, undefined, 32);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      derivedKey,
      {name: 'AES-GCM'},
      false,
      ['decrypt']
    )

    const plaintext = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv},
      cryptoKey,
      ciphertext
    )

    const text = utf8Decoder.decode(plaintext)

    return text
  }


  async nipXXEncrypt(pubkey: string, inner: UnsignedEvent, version: number): Promise<NostrEvent> {
    const event = await this.signEvent(inner)
    const content = JSON.stringify(event)
    const iv = randomBytes(16)
    const dpriv_n = (BigInt("0x" + this.privKey) * BigInt("0x" + Buffer.from(iv).toString("hex"))) % secp256k1.CURVE.n
    const epriv = dpriv_n.toString(16)
    const epub = getPublicKey(epriv)
    const encrypted = await this.nip04XEncrypt(epriv, pubkey, content, version, iv)
    const unsigned = {
      kind: 99,
      content: encrypted,
      pubkey: this.pubKey,
      tags: [["p", pubkey]]
    }
    const signed = await this.signEventWith(unsigned, epriv, epub)
    return signed
  }
 
  async nipXXDecrypt(event: NostrEvent): Promise<NostrEvent> {
    const ptags = event.tags.find((t)=>t[0]=="p")
    if (!ptags)
      throw Error("missing p tag")
    const ptag = ptags[1]
    let text: string
    if (ptag != this.pubKey) {
      const [, ivb64, ] = event.content.split('??')
      const iv = base64.decode(ivb64) 
      const dpriv_n = (BigInt("0x" + this.privKey) * BigInt("0x" + Buffer.from(iv).toString("hex"))) % secp256k1.CURVE.n
      const epriv = dpriv_n.toString(16)
      // decrypt my own sent message?
      text = await this.nip04XDecrypt(epriv, ptag, event.content)
    } else {
      text = await this.nip04XDecrypt(this.privKey, event.pubkey, event.content)
    }

    const message = JSON.parse(text)

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
