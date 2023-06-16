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
function randomPick(iterable){
  const index = Math.floor(Math.random() * iterable.length);
  return iterable[index];
}

describe('Tests for ArcadeSocial graph', () => {
  const [nsec, npub] = getTestKeys();
  const ident = new ArcadeIdentity(nsec, '1btcxxx', 'arkinox@getalby.com');
  // need a pubkey with friends to test
  ident.pubKey = 'e8ed3798c6ffebffa08501ac39e271662bfd160f688f94c45d692d8767dd345a';
  const pool = new NostrPool(ident);
  pool.setRelays(DEFAULT_RELAYS);

  it('starts building a graph automatically',() => {
    expect.assertions(4);
    const arcadeSocial = new ArcadeSocial(pool, ident);
    const waitForGraph = new Promise((resolve, reject) => {
      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      function check() {
        count++;
        if (arcadeSocial.iteration > 5) {
          arcadeSocial.pause();
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
      const pubkeys = Object.keys(graph);
      const randomPubkey = randomPick(pubkeys);
      expect(graph).toBeDefined();
      // graph shouldn't contain the user
      expect(pubkeys).not.toContain(npub)
      // graph shouldn't be empty
      expect(pubkeys.length).toBeGreaterThan(0);
      // should be pubkeys
      expect(randomPubkey.length).toBe(64);
      // traverse should yield the right number of pubkeys
      expect(graph[randomPubkey].degree ==  .traverse().length).toBe(graph[randomPubkey].size);
    });
  });
});




// import { ArcadeSocial, isValidNIP02Contact } from './arcadeSocial';  // adjust the import path to the actual one

// // Example values
// const poolExample = new NostrPool();
// const identExample = new ArcadeIdentity();

// describe('ArcadeSocial', () => {
//   let arcadeSocial;

//   beforeEach(() => {
//     arcadeSocial = new ArcadeSocial(poolExample, identExample);
//   });

//   it('should initialize correctly', () => {
//     expect(arcadeSocial.pool).toEqual(poolExample);
//     expect(arcadeSocial.ident).toEqual(identExample);
//     expect(arcadeSocial.socialGraph).toEqual({});
//     expect(arcadeSocial.iteration).toEqual(0);
//   });

//   // Add more test cases here...
// });

// describe('isValidNIP02Contact', () => {
//   it('should return true for valid contact', () => {
//     const contact = ['p', 'a'.repeat(64)];
//     expect(isValidNIP02Contact(contact)).toBeTruthy();
//   });

//   it('should return false for invalid contact', () => {
//     const contact = ['p', 'a'.repeat(63)];
//     expect(isValidNIP02Contact(contact)).toBeFalsy();
//   });

//   // Add more test cases here...
// });
