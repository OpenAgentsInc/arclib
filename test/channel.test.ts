/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import Nip28Channel from '../src/channel';

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

describe('Nip28Channel', () => {
  it('can create', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const channel = new Nip28Channel(pool);
    const group = await channel.create({
      name: 'name',
      about: 'about',
      picture: 'picture',
    });
    console.log('group event', group);
    expect(async () => {
      await channel.create({
        name: 'name',
        about: 'about',
        picture: 'picture',
      });
    }).rejects.toBeTruthy();
    expect(await channel.getChannel('name')).toBeTruthy();
    expect(await channel.list(group.id)).toHaveLength(0);
    expect(await channel.getMeta(group.id)).toBeTruthy();
    console.log('update channel metadata', group.id);
    const evt = await channel.setMeta(group.id, {
      name: 'name [updated]',
      about: 'about [updated]',
      picture: 'picture [updated]',
    });
    console.log('updated event', evt);
    console.log('sending to channel', group.id);
    const ev = await channel.send(group.id, 'hello world');
    console.log('sent event', ev);
    expect(await channel.list(group.id)).toHaveLength(1);
    await pool.close();
  });
});
