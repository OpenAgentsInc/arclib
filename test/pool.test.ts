/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');

import NostrMini from 'nostrmini'

import { nip19, generatePrivateKey } from 'nostr-tools';

import { NostrPool, ArcadeIdentity } from '../src';

// const relays = ['wss://relay.nostr.band/', 'wss://nos.lol/'];
const relays = ['ws://127.0.0.1:3333']

const priv = generatePrivateKey();
const nsec = nip19.nsecEncode(priv);
const ident = new ArcadeIdentity(nsec, '', '');

function defer() {
  const deferred: any = {};
  deferred.promise = new Promise<any>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

function waiter(delay = 5000) {
  const deferred = defer();
  setTimeout(() => {
    deferred.reject('timed out');
  }, delay);
  return [deferred.resolve, deferred.promise] as [
    (res: any) => any,
    Promise<any>
  ];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const srv = new NostrMini()

beforeAll(()=>{
  srv.listen(3333)
})

afterAll(async () => {
  await srv.close()
})

describe('NostrPool', () => {
  it('can send and receive', async () => {
    const pool = new NostrPool(ident);
    await pool.setAndCheckRelays(relays, [1, 11]);
    const [resolver, wait] = waiter(9000);
    pool.addEventCallback((ev) => {
      resolver(ev);
    });
    // looks like many relays do a poor job of leaving sockets open and sending future messages
    // todo: investigate this, probably need to write/run our own test relay
    const event = await pool.send({ content: 'yo', tags: [], kind: 1 });
    console.log('sent event, waiting for reply', event);
    await sleep(1000);
    console.log('req started');
    await pool.start([{ authors: [ident.pubKey] }]);
    await wait;
  }, 10000);
});
