/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto') });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity, NostrEvent } from '../src';
import { strict as assert } from 'assert';
import { PrivateMessageManager } from '../src/private';
import { ContactManager } from '../src/contacts';

const ident = ArcadeIdentity.generate();
const ct1 = ArcadeIdentity.generate();
const ct2 = ArcadeIdentity.generate();
const srv = new NostrMini();
const relays: string[] = [];
const pool = new NostrPool(ident);

beforeAll(async () => {
  const port: number = srv.listen(0).address().port;
  relays.push(`ws://127.0.0.1:${port}`);
  await pool.setRelays(relays)
});

afterAll(async () => {
  await pool.close()
  await srv.close();
});

test('contact:basic', async () => {
  const contacts = new ContactManager(pool);
  let res = []

  await contacts.add({pubkey: ct1.pubKey, secret: false, legacy: false})
  
  res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct1.pubKey, secret: false, legacy: false})
  
  await contacts.readContacts()
  res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct1.pubKey, secret: false, legacy: false})
  
  await contacts.add({pubkey: ct2.pubKey, secret: false, legacy: false})
  res = await contacts.list()
  expect(res[0].length).toEqual(2)
  
  await contacts.readContacts()
  await contacts.add({pubkey: ct2.pubKey, secret: false, legacy: false})
  res = await contacts.list()
  expect(res[0].length).toEqual(2)
  await contacts.remove(ct1.pubKey)
  await contacts.readContacts()
  res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct2.pubKey, secret: false, legacy: false})
});

test('contact:secret', async () => {
  const contacts = new ContactManager(pool);
  await contacts.add({pubkey: ct1.pubKey, secret: true, legacy: false})
  await contacts.readContacts()
  const res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct2.pubKey, secret: true, legacy: false})
});

test('contact:legacy', async () => {
  const contacts = new ContactManager(pool);
  await contacts.add({pubkey: ct1.pubKey, secret: false, legacy: true})
  await contacts.readContacts()
  const res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct2.pubKey, secret: false, legacy: true})
});
