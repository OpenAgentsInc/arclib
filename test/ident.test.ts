/* eslint-disable @typescript-eslint/no-explicit-any */

Object.assign(global, { crypto: require('crypto') });

import {
  nip19,
  generatePrivateKey,
  getPublicKey,
  verifySignature,
} from 'nostr-tools';
import { ArcadeIdentity } from '../src/ident';

function getTestKeys() {
  const sk = generatePrivateKey();
  const nsec = nip19.nsecEncode(sk);
  const npub = getPublicKey(sk);
  return [ nsec, npub ]
}

describe('ident:', () => {
  const [ nsec, npub ] = getTestKeys();

  it('can nipxxencrypt', async () => {
  const [ nsec2 ] = getTestKeys();
    const bob = new ArcadeIdentity(
      nsec,
      '1btcxxx',
      'simulx@walletofsatoshi.com'
    );
    const alice = new ArcadeIdentity(
       nsec2,
      '1btcxxx',
      'simulx@walletofsatoshi.com'
    );
 
    const inner = await bob.signEvent({
      kind: 1,
      tags: [['tag1'], ['tag2']],
      content: 'test-content',
    });
    const outer = await bob.nipXXEncrypt(alice.pubKey, inner, 1)
    const same = await alice.nipXXDecrypt(outer)

    /* disable ability to decrypt sent messages for now
      const same2 = await bob.nipXXDecrypt(outer)
    */

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore 
    const comp = ({kind, tags, content, created_at, pubkey, id})=>({kind, tags, content, created_at, pubkey, id})

    expect(comp(same)).toStrictEqual(comp(inner))
    /* disable ability to decrypt sent messages for now
      expect(comp(same)).toStrictEqual(comp(same2))
    */
  })

  it('can selfencrypt', async () => {
    const bob = new ArcadeIdentity(
      nsec
    );
    const content = await bob.selfEncrypt("data")
    const dec = await bob.selfDecrypt(content)
    expect(dec).toEqual("data")
  })

  it('can 44x encrypt', async () => {
    const alice = new ArcadeIdentity(
      nsec
    );
    const sk = generatePrivateKey();
    const bob = new ArcadeIdentity(
     sk
    );
    const event = await alice.nip44XEncrypt(bob.pubKey, "data")
    const dec = await bob.nip44XDecrypt(alice.pubKey, event.content)
    expect(dec.content).toEqual("data")
    expect(dec.pubkey).toEqual(alice.pubKey)
  })

  it('returns a valid ArcadeEvent', async () => {
    const identity = new ArcadeIdentity(
      nsec,
      '1btcxxx',
      'simulx@walletofsatoshi.com'
    );
    const event = await identity.signEvent({
      kind: 1,
      tags: [['tag1'], ['tag2']],
      content: 'test-content',
    });

    expect(verifySignature(event)).toBeTruthy();
    expect(event.id).toBeTruthy();
    expect(event.kind).toBe(1);
    expect(event.pubkey).toBe(npub);
    expect(event.tags).toEqual([['tag1'], ['tag2']]);
    expect(event.content).toBe('test-content');
    expect(event.sig).toBeTruthy();
    expect(event.created_at).toBeTruthy();
    expect(identity.isMine(event)).toBeTruthy();
  });

  it('throws an error for invalid event kind', async () => {
    const [ nsec ] = getTestKeys();
    const identity = new ArcadeIdentity(nsec, 'test-address', 'test-lnurl');

    await expect(
      identity.signEvent({
        kind: 'faux' as any,
        tags: [['tag1'], ['tag2']],
        content: 'test-content',
      })
    ).rejects.toThrow();
  });
});
