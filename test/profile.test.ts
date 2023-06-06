/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto') });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import { ProfileManager } from '../src/profile';

const ident = ArcadeIdentity.generate();

const srv = new NostrMini();
const relays: string[] = [];

let  pool: NostrPool

beforeAll(async () => {
  const port: number = srv.listen(0).address().port;
  relays.push(`ws://127.0.0.1:${port}`);
  pool = new NostrPool(ident);
  await pool.setRelays(relays);
});

afterAll(async () => {
  await pool.close();
  await srv.close();
});

test('prof: can load', async () => {
    const prof = new ProfileManager(pool);
    const info =  {
        about: "me",
        bio: "whatever", 
        secret_setting: "don't tell"
    }

    const ev = await prof.save(info, ["secret_setting"])
    expect(ev).toBeTruthy()
    const cont = JSON.parse(ev.content)
    expect(cont.other).toBeTruthy()
    expect(cont.about).toEqual("me")
    const ld = await prof.load()
    expect(ld).toEqual(info)
});
