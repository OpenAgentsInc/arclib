/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto') });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity, NostrEvent } from '../src';
import { strict as assert } from 'assert';
import { PrivateMessageManager } from '../src/private';

const ident1 = ArcadeIdentity.generate();
const ident2 = ArcadeIdentity.generate();

const srv = new NostrMini();
const relays: string[] = [];

beforeAll(() => {
  const port: number = srv.listen(0).address().port;
  relays.push(`ws://127.0.0.1:${port}`);
});

afterAll(async () => {
  await srv.close();
});

test('dm:simple', async () => {
  const pool1 = new NostrPool(ident1);
  const pool2 = new NostrPool(ident2);
  await pool1.setRelays(relays);
  await pool2.setRelays(relays);
  const dms1 = new PrivateMessageManager(pool1);
  const dms2 = new PrivateMessageManager(pool2);
  await dms1.send(ident2.pubKey, 'yo');
  assert((await dms2.list())[0].content == 'yo');
  assert((await dms1.list({}, false, ident2.pubKey))[0].content == 'yo');
  pool1.close();
  pool2.close();
});

test('dm:directed 44x', async () => {
  const pool1 = new NostrPool(ident1);
  const pool2 = new NostrPool(ident2);
  await pool1.setRelays(relays);
  await pool2.setRelays(relays);
  const dms1 = new PrivateMessageManager(pool1);
  const dms2 = new PrivateMessageManager(pool2);
  const ev = await dms1.send44X(ident2.pubKey, "zz", "XXXX")
  console.log(ev)
  assert((await dms1.list({"#e": ["XXXX"]}, false, ident2.pubKey))[0].content == 'zz');
  assert((await dms2.list({"#e": ["XXXX"]}, false, ident1.pubKey))[0].content == 'zz');
  assert((await dms2.list({"#e": ["XXXX"]}, false, [ident1.pubKey, ident2.pubKey]))[0].content == 'zz');
  pool1.close();
  pool2.close();
});

test('dm:sub', async () => {
  const pool1 = new NostrPool(ident1);
  const pool2 = new NostrPool(ident2);
  await pool1.setRelays(relays);
  await pool2.setRelays(relays);
  const dms1 = new PrivateMessageManager(pool1);
  const dms2 = new PrivateMessageManager(pool2);

  const evs: NostrEvent[] = [];
  await dms1.send(ident2.pubKey, 'yo');

  await new Promise<void>((res) => {
    dms2.sub(
      (ev) => {
        evs.push(ev);
        res();
      },
      {},
      async () => res()
    );
  });

  expect(evs[0].content).toBe('yo');

  pool1.close();
  pool2.close();
});
