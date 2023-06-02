/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto') });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import EncChannel from '../src/encchannel';

// const relays = ['wss://relay.nostr.band/', 'wss://nos.lol/'];

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

describe('EncChannel', () => {
  it('can create', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const echan = new EncChannel(pool);
    const group = await echan.createPrivate(
      {
        name: 'name',
        about: 'about',
        picture: 'picture',
      },
      []
    );
    expect(await echan.list(group)).toHaveLength(0);
    expect(await echan.getChannelByName('name')).toBeTruthy();
    console.log('sending to channel', group.id);
    const ev = await echan.send(group.id, 'hello world');
    console.log('sent event', ev);
    expect(await echan.list(group)).toHaveLength(1);

    const bob = ArcadeIdentity.generate();
    const pool2 = new NostrPool(bob);
    await pool2.setRelays(relays);
    const echan2 = new EncChannel(pool2);

    expect(await echan2.listChannels()).toHaveLength(0);

    await echan.invite({ ...group, members: [bob.pubKey] });

    expect(await echan2.listChannels()).toHaveLength(1);

    pool.close();
    pool2.close();
  });

  it('can meta', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const echan = new EncChannel(pool);
    const group = await echan.createPrivate(
      {
        name: 'name',
        about: 'about',
        picture: 'picture',
      },
      []
    );
    await echan.setMeta(group.id, {
      name: 'bob',
      about: 'bob',
      picture: 'bob',
    });
    await echan.setMeta(group.id, {
      name: 'bob2',
      about: 'bob2',
      picture: 'bob2',
    });
    expect(await echan.getMeta(group)).toEqual({
      name: 'bob2',
      about: 'bob2',
      picture: 'bob2',
    });
    pool.close();
  });
});
