/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
require('isomorphic-unfetch');

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import { waiter } from './waiter';

const ident = ArcadeIdentity.generate();
const srv = new NostrMini();
const relays: string[] = []

beforeAll(() => {
  const port: number = srv.listen(0).address().port;
  relays.push(`ws://127.0.0.1:${port}`)
});

afterAll(async () => {
  await srv.close();
});

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
    console.log('req started');
    pool.start([{ authors: [ident.pubKey] }]);
    await wait;
    pool.stop();
    console.log("stopping pool")
    await pool.close();
  });
});
