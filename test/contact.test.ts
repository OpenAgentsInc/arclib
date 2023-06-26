/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto').webcrypto });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import { ContactManager, Contact } from '../src/contacts';

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
  let res: Contact[] = []

  await contacts.add({pubkey: ct1.pubKey, secret: false, legacy: false})
  
  res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct1.pubKey, secret: false, legacy: false})
  
  await contacts.readContacts()
  res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct1.pubKey, secret: false, legacy: false})
  
  await contacts.add({pubkey: ct2.pubKey, secret: false, legacy: false})
  res = await contacts.list()
  expect(res.length).toEqual(2)
  
  await contacts.readContacts()
  await contacts.add({pubkey: ct2.pubKey, secret: false, legacy: false})
  res = await contacts.list()
  expect(res.length).toEqual(2)
  await contacts.remove(ct1.pubKey)
  await contacts.readContacts()
  res = await contacts.list()
  
  expect(res[0]).toEqual({pubkey: ct2.pubKey, secret: false, legacy: false})
  
  await contacts.remove(ct2.pubKey)
  await contacts.readContacts()
  res = await contacts.list()
  expect(res.length).toEqual(0)
});

test('contact:secret', async () => {
  pool.ident = ArcadeIdentity.generate();
  const contacts = new ContactManager(pool);
  let res = await contacts.list()
  expect(res.length).toEqual(0)
  await contacts.add({pubkey: ct1.pubKey, secret: true, legacy: false})
  await contacts.readContacts()
  res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct1.pubKey, secret: true, legacy: false})
  const g = await contacts.get(ct1.pubKey)
  expect(g).toEqual({pubkey: ct1.pubKey, secret: true, legacy: false})
  await contacts.remove(ct1.pubKey)
});

test('contact:legacy', async () => {
  pool.ident = ArcadeIdentity.generate();
  const contacts = new ContactManager(pool);
  await contacts.add({pubkey: ct1.pubKey, secret: false, legacy: true})
  await contacts.readContacts()
  const res = await contacts.list()
  expect(res[0]).toEqual({pubkey: ct1.pubKey, secret: false, legacy: true})
  await contacts.remove(ct1.pubKey)
});
