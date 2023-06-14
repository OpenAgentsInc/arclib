/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
require('isomorphic-unfetch');

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import { waiter, wait_for, sleep } from './waiter';
import { connectDb } from '../src/db';
import { assert } from 'console';

const ident = ArcadeIdentity.generate();
const srv = new NostrMini();
const relays: string[] = [];

beforeAll(() => {
  const port: number = srv.listen(0).address().port;
  relays.push(`ws://127.0.0.1:${port}`);
});

afterAll(async () => {
  await srv.close();
});

describe('NostrPool', () => {
  it('can send and receive', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
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
    console.log('stopping pool');
    await pool.close();
  });

  it('can integrate storage', async () => {
    const db = connectDb();
    const pool1 = new NostrPool(ident, db);
    const pool2 = new NostrPool(ident);
    if (!pool1.db) throw Error;
    await pool1.setRelays(relays);
    await pool2.setRelays(relays);

    // same pool send goes to db instanty
    const event = await pool1.send({ content: 'yo', tags: [], kind: 1 });
    expect((await pool1.db.list([{ authors: [ident.pubKey] }]))[0].id).toBe(
      event.id
    );

    // other sender, we catch the event... also goes to the db
    const [resolver, wait] = waiter(4000);
    pool1.sub([{ authors: [ident.pubKey] }], (ev) => {
      if (ev.content == 'bob1') {
        console.log('resolving waiter');
        resolver(ev);
      }
    });
    await pool2.send({
      content: 'bob1',
      tags: [['e', 'reply-to-id']],
      kind: 1,
    });
    console.log('waiting');
    await wait;
    expect((await pool1.db.list([{ authors: [ident.pubKey] }]))[0].id).toBe(
      event.id
    );

    // force a disconnect
    pool1.close();
    pool2.close();

    // it's ok, we still have it
    expect((await pool1.list([{ authors: [ident.pubKey] }]))[0].id).toBe(
      event.id
    );
  });

  it('notifys me', async () => {
    const db = connectDb();
    const pool1 = new NostrPool(ident, db);
    await pool1.setRelays(relays);

    // pools keep monitoring
    const [res, wait] = waiter();
    pool1.sub([{ '#p': ['destpk'] }], res);
    await pool1.send({ content: 'yo', tags: [], kind: 1 });
    // calling list doesn't interfere with previous subscriptions of the same type
    const pk = await pool1.list([{ '#p': ['destpk'] }]);
    assert(!pk);
    await pool1.send({ content: 'yo', tags: [['p', 'destpk']], kind: 1 });

    // old sub gets the event, we're still monitoring it!
    await wait;

    pool1.close();
  });

  it('db keeps track even after list is done', async () => {
    const db = connectDb();
    const pool1 = new NostrPool(ident, db);
    if (!pool1.db) throw Error;
    await pool1.setRelays(relays);

    const pool2 = new NostrPool(ident);
    await pool2.setRelays(relays);

    // implicit sub!
    const pk = await pool1.list([{ '#p': ['uu77'] }]);
    assert(!pk);

    // sending pool2...
    await pool2.send({ content: 'yo', tags: [['p', 'uu77']], kind: 1 });

    await wait_for(async () => {
      if (!pool1.db) throw Error;
      return (await pool1.db.list([{ '#p': ['uu77'] }])).length != 0;
    });

    pool1.close();
    pool2.close();
  });

  it('queries for new stuff only', async () => {
    const db = connectDb();
    const pool1 = new NostrPool(ident, db);
    if (!pool1.db) throw Error;
    await pool1.setRelays(relays);

    await pool1.send({ content: '1', tags: [['p', '5566']], kind: 1 });
    await pool1.send({ content: '2', tags: [['p', '5566']], kind: 1 });
    await pool1.send({ content: '3', tags: [['p', '5566']], kind: 1 });

    await pool1.list([{ kinds: [1], '#p': ['5566'] }]);

    await sleep(2);

    const pool2 = new NostrPool(ident, db);

    await pool1.send({ content: '4', tags: [['p', '5566']], kind: 1 });

    const ret = await pool2.list([{ kinds: [1], '#p': ['5566'] }]);

    expect(ret.length).toBe(4);
    pool1.close();
  });

  it('get user profile and contact', async () => {
    const db = connectDb();
    const pool1 = new NostrPool(ident, db);
    if (!pool1.db) throw Error;
    await pool1.setRelays(relays);

    await pool1.send({
      content: JSON.stringify({ name: 'yo' }),
      kind: 0,
      tags: [],
    });

    await pool1.send({
      content: '',
      kind: 3,
      tags: [['p', ident.pubKey]],
    });

    const profile = await pool1.getProfile(ident.pubKey);
    expect(profile.name).toBeTruthy;

    const contacts = await pool1.getContacts();
    expect(contacts).toBeTruthy;
  });
});
