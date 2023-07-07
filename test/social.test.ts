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
  "wss://welcome.nostr.wine",
  "wss://relay.nostr.band/all",
  "wss://nostr.mutinywallet.com",
]

function getTestKeys() {
  const sk = generatePrivateKey();
  const nsec = nip19.nsecEncode(sk);
  const npub = getPublicKey(sk);
  return [nsec, npub]
}

// select a random element from an iterable
function randomPick(iterable: Array<string>){
  const index = Math.floor(Math.random() * iterable.length);
  return iterable[index];
}

describe('Tests for ArcadeSocial graph', () => {
  const [nsec, npub] = getTestKeys();
  const ident = new ArcadeIdentity(nsec, '1btcxxx', 'arkinox@getalby.com');
  // need a pubkey with friends to test
  ident.pubKey = 'e8ed3798c6ffebffa08501ac39e271662bfd160f688f94c45d692d8767dd345a';
  // ident.pubKey = 'b2caa9b3ef30faad605e5eeed8da2c8fd7b4ca872becdc440029f4fb9eab0fb5';
  const pool = new NostrPool(ident);
  pool.setRelays(DEFAULT_RELAYS);
  const arcadeSocial = new ArcadeSocial(pool, ident);

  it('starts building a graph automatically',() => {
    // expect.assertions(8);
    expect.assertions(5);
    const waitForGraph = new Promise((resolve, reject) => {
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      function check() {
        count++;
        if (arcadeSocial.iteration > 1) {
          // arcadeSocial.pause();
          resolve(arcadeSocial.socialGraph);
        } else if (count >= 60) {
          reject('Graph was not built in time; aborted instead of waiting forever.');
        } else {
          setTimeout(check, 1000);
        }
      }
      check();
    });
    return waitForGraph.then(value => {
      const graph = value as SocialGraph;
      const pubkeys: Array<string> = Object.keys(graph);
      const randomPubkey: string = randomPick(pubkeys);
      expect(graph).toBeDefined();
      // graph shouldn't contain the user
      expect(pubkeys).not.toContain(npub)
      // graph shouldn't be empty
      expect(pubkeys.length).toBeGreaterThan(0);
      // should be pubkeys
      expect(randomPubkey.length).toBe(64);
      // social distance to self should be 0
      expect(arcadeSocial.distance(ident.pubKey)).toEqual(0);

      // distance tests: must be specific to a known pubkey with these relationships. arkinox's pubkey has these.
      // social distance to guy swan should be 1
      // expect(arcadeSocial.distance("b9e76546ba06456ed301d9e52bc49fa48e70a6bf2282be7a1ae72947612023dc")).toEqual(1);
      // social distance to umbrel should be 2
      // expect(arcadeSocial.distance("ea2e3c814d08a378f8a5b8faecb2884d05855975c5ca4b5c25e2d6f936286f14")).toEqual(2);
      // social distance to newly generated pubkey should be 3
      // expect(arcadeSocial.distance("84ac01809888b0ec74da0cc21dad839248f69cf4007c90ab2c56c21fa0eff545")).toEqual(3);
    });
  }, 1000 * 60 * 10);

  it('can be paused and resumed', () => {
    expect.assertions(2);
    // pause it
    arcadeSocial.pause();
    expect(arcadeSocial.paused).toBeTruthy();
    // resume it
    arcadeSocial.start();
    expect(arcadeSocial.paused).toBeFalsy();
  });

  it('can create a full graph', () => {
    expect.assertions(1);
    const waitForGraph = new Promise((resolve, reject) => {
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      function check() {
        count++;
        if (arcadeSocial.idle || count >= 60 * 5) {
          arcadeSocial.pause();
          setTimeout(() => resolve(arcadeSocial.socialGraph), 1000);
        } else {
          setTimeout(check, 1000);
        }
      }
      check();
    });
    return waitForGraph.then(value => {
      const graph = value as SocialGraph;
      const pubkeys: Array<string> = Object.keys(graph);
      expect(pubkeys.length).toBeGreaterThan(0);
      console.log(`Graph contains ${pubkeys.length} pubkeys.`)
    });
  }, 1000 * 60 * 10);
});
