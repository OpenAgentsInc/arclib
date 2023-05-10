import { nip19, generatePrivateKey, getPublicKey } from 'nostr-tools';
import { ArcadeIdentity } from '../src/ident';

function getTestKeys() {
  let sk = generatePrivateKey();
  let nsec = nip19.nsecEncode(sk);
  let npub = getPublicKey(sk);
  return { nsec, npub };
}

describe('signEvent', () => {
  let { nsec, npub } = getTestKeys();

  it('returns a valid ArcadeEvent', async () => {
    const identity = new ArcadeIdentity(
      nsec,
      '1btcxxx',
      'simulx@walletofsatoshi.com'
    );
    const event = await identity.signEvent(
      {
        kind: 1,
        tags: [['tag1'], ['tag2']],
        content: 'test-content',
      }
    );

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
    let { nsec } = getTestKeys();
    const identity = new ArcadeIdentity(nsec, 'test-address', 'test-lnurl');

    await expect(
      identity.signEvent(
        {
          kind: 'faux',
          tags: [['tag1'], ['tag2']],
          content: 'test-content',
        }
      )
    ).rejects.toThrow();
  });
});
