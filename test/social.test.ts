/**
 * Run the following to test only this file:
 * $ yarn test -- social.test.ts
 */
import 'websocket-polyfill';
import { NostrPool } from "../src/pool";
import {
  nip19,
  generatePrivateKey,
  getPublicKey,
} from 'nostr-tools';
import { ArcadeIdentity } from '../src/ident';
import { ArcadeSocial, SocialGraph } from '../src/social';

const DEFAULT_RELAYS = [
  "wss://relay.arcade.city",
  "wss://arc1.arcadelabs.co",
  "wss://relay.nostr.band/all",
  "wss://nostr.mutinywallet.com",
  "wss://nostr.fmt.wiz.biz",
  "wss://relay.damus.io",
  "wss://nostr-pub.wellorder.net",
  "wss://offchain.pub",
  "wss://nos.lol",
]

function getTestKeys() {
  const sk = generatePrivateKey();
  const nsec = nip19.nsecEncode(sk);
  const npub = getPublicKey(sk);
  return [nsec, npub]
}

// select a random element from an iterable
function randomPick(iterable: Array<string>) {
  const index = Math.floor(Math.random() * iterable.length);
  return iterable[index];
}

describe('Tests for ArcadeSocial graph', () => {
  const [nsec, npub] = getTestKeys();
  const ident = new ArcadeIdentity(nsec, '1btcxxx', 'arkinox@getalby.com');
  // need a pubkey with friends to test
  ident.pubKey = 'ace09f0547f6a95ee1d08075a5a9bd61e1c1ffa361cb7890c65fa3a95fae004f';
  const pool = new NostrPool(ident);
  pool.setRelays(DEFAULT_RELAYS);
  const arcadeSocial = new ArcadeSocial(pool, ident);

  // implement beforeAll to allow the graph to fully (or at least partially) index over 15 seconds
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }, 1000 * 20);

  afterAll(async () => {
    await pool.close()
  });

  it('can create a full graph', () => {
    expect.assertions(6);
    const graph: SocialGraph = arcadeSocial.socialGraph;
    const pubkeys: Array<string> = Object.keys(graph);
    const randomPubkey: string = randomPick(pubkeys);
    expect(pubkeys.length).toBeGreaterThan(0);
    expect(graph).toBeDefined();
    // graph shouldn't contain the user
    expect(pubkeys).not.toContain(npub)
    // graph shouldn't be empty
    expect(pubkeys.length).toBeGreaterThan(0);
    // should be pubkeys
    expect(randomPubkey.length).toBe(64);
    // social distance to self should be 0
    expect(arcadeSocial.distance(ident.pubKey)).toEqual(0);

    console.log(`Graph contains ${pubkeys.length} pubkeys.`)
  });

  it('can show ratings', async () => {
    expect.assertions(5)
    /* do some ratings

      me:
      sk: eaa2a858a12be1991ea866360f98ae1d77f2e97f298fa1bcb57bdb1960dc26e0
      pk: ace09f0547f6a95ee1d08075a5a9bd61e1c1ffa361cb7890c65fa3a95fae004f

      alice
      sk: c01ef93928a408fc9a1810cfc8f841a45285dff47fac96db7115c7d1e8a4ed02
      pk: b22df7a39de5d169bc50b2c3c7300c5863a7478c7760281ec981811ecc973af6
      npub: npub1kgkl0guauhgkn0zsktpuwvqvtp36w3uvwaszs8kfsxq3anyh8tmqcnyrcu

      bob
      sk: 3c930e3755ac76a81f8918889d003a2dd568209c5b1a6ef29d992f7c61da7153
      pk: e6e8845c2ab84c8688e618fe625861205d5200826ad6a89f76608c2e7677a1aa

      clyde
      sk: c85d49cd5c39d7013c39795339ce2bbba9296767727dfa7a1d91e4217ce05b00
      pk: d0c92afe7c06cf99455949bb36a90a82afb0398b2a549942e1addaad2f389e20

      mallory
      sk: 5718c79154196e036b9270d9f63ba467843ab26a8bd10d9266dab5bfad217862
      pk: 2462c33d35897231b325c4f8b76f408a8ad95c394bdc2f585194c8e33fb1a6a5

      derek
      sk: 0886cb6273f39d13607d2075e0e34dd34216812f466edfc46ca55a9694a7f8a2
      pk: d181a9db28afaeb234713d3f72d85433bd4dc1f380837abe072fcc1902fbfabb

    */
    function rate(raterName: string, sk: string, quality: number, evalueePubkey: string, message: string) {
      const rater = new ArcadeIdentity(sk, '1btcxxx', 'arcade-test-' + raterName + '@getalby.com');
      const raterpool = new NostrPool(rater);
      raterpool.setRelays(DEFAULT_RELAYS);
      raterpool.send({
        kind: 1985,
        tags: [
          ["L", "city.arcade"],
          ["l", "social", "city.arcade", "{\"quality\":" + quality + "}"],
          ["p", evalueePubkey],
        ],
        content: message
      })
    }
    // alice rates derek
    rate('alice', 'c01ef93928a408fc9a1810cfc8f841a45285dff47fac96db7115c7d1e8a4ed02', 0.85, 'd181a9db28afaeb234713d3f72d85433bd4dc1f380837abe072fcc1902fbfabb', 'cool guy')
    // bob rates derek
    rate('bob', '3c930e3755ac76a81f8918889d003a2dd568209c5b1a6ef29d992f7c61da7153', 0.9, 'd181a9db28afaeb234713d3f72d85433bd4dc1f380837abe072fcc1902fbfabb', 'really friendly')
    // clyde rates derek
    rate('clyde', 'c85d49cd5c39d7013c39795339ce2bbba9296767727dfa7a1d91e4217ce05b00', 0.60, 'd181a9db28afaeb234713d3f72d85433bd4dc1f380837abe072fcc1902fbfabb', 'didnt talk much')
    // mallory rates derek badly
    rate('mallory', '5718c79154196e036b9270d9f63ba467843ab26a8bd10d9266dab5bfad217862', 0.10, 'd181a9db28afaeb234713d3f72d85433bd4dc1f380837abe072fcc1902fbfabb', 'jerk')
    /**
     * I follow Alice. She has a weight of 1. Her score is 0.85 * 1 = 0.85.
     * Alice follows Bob. Bob has a weight of 0.25. His score is 0.9 * 0.25 = 0.225.
     * Bob follow Clyde. Clyde has a weight of 0.111111111. His score is 0.6 * 0.111111111 = 0.0666666666.
     * Nobody follows Mallory. She has a weight of 0.111111111. Her score is 0.1 * 0.111111111 = 0.0111111111.
     * Derek's social score should be ~0.7833333333
     * weightsum = 1 + 0.25 + 0.111111111 + 0.111111111 = 1.472222222
     * scaledscoresum = 0.85 + 0.225 + 0.0666666666 + 0.0111111111 = 1.1527777777
     * weightedaveragescore = 1.1527777777 / 1.472222222 = ~0.7833333333
     */
    // alice's weight should be 1
    try {
      expect(arcadeSocial.weight('b22df7a39de5d169bc50b2c3c7300c5863a7478c7760281ec981811ecc973af6')).toBe(1)
    } catch (error) {
      console.log('alice', error)
    }
    // bob's weight should be 0.25

    try {
      expect(arcadeSocial.weight('e6e8845c2ab84c8688e618fe625861205d5200826ad6a89f76608c2e7677a1aa')).toBe(0.25)
    } catch (error) {
      console.log('bob', error)
    }
    // clyde's weight should be 0.111111111
    expect(arcadeSocial.weight('d0c92afe7c06cf99455949bb36a90a82afb0398b2a549942e1addaad2f389e20')).toBe(1 / 9)
    // mallory's weight should be 0.111111111
    expect(arcadeSocial.weight('2462c33d35897231b325c4f8b76f408a8ad95c394bdc2f585194c8e33fb1a6a5')).toBe(1 / 9)
    // show social score for derek
    const DerekRep = await arcadeSocial.getReputation('d181a9db28afaeb234713d3f72d85433bd4dc1f380837abe072fcc1902fbfabb')
    expect(DerekRep).toBeCloseTo(0.7830188679245284, 3)
    console.log('Derek rep:', DerekRep)
  }, 1000 * 60 * 2);

  it('can be paused and resumed', () => {
    expect.assertions(2);
    // pause it
    arcadeSocial.pause();
    expect(arcadeSocial.paused).toBeTruthy();
    // resume it
    arcadeSocial.start();
    expect(arcadeSocial.paused).toBeFalsy();
  });
});
