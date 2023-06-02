/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto') });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import { ChannelManager } from '../src/channel';

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

describe('ChannelManager', () => {
  it('can priv', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const echan = new ChannelManager(pool);
    const group = await echan.create({
      name: 'name',
      about: 'about',
      picture: 'picture',
      is_private: true,
    });
    expect(
      await echan.list({ channel_id: group.id, privkey: group.privkey })
    ).toHaveLength(0);
    console.log('sending to channel', group.id);
    const ev = await echan.send({
      channel_id: group.id,
      content: 'hello world',
      is_private: true,
    });
    console.log('sent event', ev);
    expect(
      await echan.list({ channel_id: group.id, privkey: group.privkey })
    ).toHaveLength(1);
    console.log(await echan.listChannels());
    expect((await echan.listChannels())[0].id).toEqual(group.id);
    await pool.close();
  });

  it('can pub', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const echan = new ChannelManager(pool);
    const group = await echan.create({
      name: 'name',
      about: 'about',
      picture: 'picture',
      is_private: false,
    });
    expect(await echan.list({ channel_id: group.id })).toHaveLength(0);
    console.log('sending to channel', group.id);
    const ev = await echan.send({
      channel_id: group.id,
      content: 'hello world',
      is_private: false,
    });
    console.log('sent event', ev);
    expect(await echan.list({ channel_id: group.id })).toHaveLength(1);
    await pool.close();
  });

  it('can meta priv', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const echan = new ChannelManager(pool);
    const group = await echan.create({
      name: 'name',
      about: 'about',
      picture: 'picture',
      is_private: true,
    });
    await echan.setMeta(group.id, true, {
      name: 'bob2',
      about: 'bob2',
      picture: 'bob2',
    });
    expect(await echan.getMeta(group.id, group.privkey)).toEqual({
      name: 'bob2',
      about: 'bob2',
      picture: 'bob2',
      is_private: true,
    });
    await pool.close();
  });

  it('can meta pub', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const echan = new ChannelManager(pool);
    const group = await echan.create({
      name: 'name',
      about: 'about',
      picture: 'picture',
      is_private: false,
    });
    await echan.setMeta(group.id, false, {
      name: 'bob2',
      about: 'bob2',
      picture: 'bob2',
    });
    const { name, about, picture, is_private } = await echan.getMeta(group.id);
    expect({ name, about, picture, is_private }).toEqual({
      name: 'bob2',
      about: 'bob2',
      picture: 'bob2',
      is_private: false,
    });
    await pool.close();
  });
});
