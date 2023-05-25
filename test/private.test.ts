/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto') });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import {strict as assert} from 'assert'
import Nip04Manager from '../src/private';

const ident1 = ArcadeIdentity.generate();
const ident2 = ArcadeIdentity.generate();

const srv = new NostrMini();
const relays: string[] = []

beforeAll(() => {
  const port: number = srv.listen(0).address().port;
  relays.push(`ws://127.0.0.1:${port}`)
});

afterAll(async () => {
  await srv.close();
});

test('dm:simple', async () => {
    const pool1 = new NostrPool(ident1);
    const pool2 = new NostrPool(ident2);
    await pool1.setRelays(relays);
    await pool2.setRelays(relays);
    const dms1 = new Nip04Manager(pool1);
    const dms2 = new Nip04Manager(pool2);
    await dms1.send(ident2.pubKey, "yo")
    assert((await dms2.list())[0].content == "yo")
    pool1.close()
    pool2.close()
});
