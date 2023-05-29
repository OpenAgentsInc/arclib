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

describe('signEvent', () => {
  const [ nsec, npub ] = getTestKeys();

  it('can nipxxencrypt', async () => {
  const [ nsec2, npub2 ] = getTestKeys();
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
    const same = await alice.nipXXDecrypt(alice.privKey, outer)

    // @ts-ignore 
    const comp = ({kind, tags, content, created_at, pubkey, id})=>({kind, tags, content, created_at, pubkey, id})

    expect(comp(same)).toStrictEqual(comp(inner))
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
