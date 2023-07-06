/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

require('websocket-polyfill');
require('isomorphic-unfetch');
Object.assign(global, { crypto: require('crypto').webcrypto });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity } from '../src';
import { ContactManager, Contact, resolvePubkey } from '../src/contacts';

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


test('contact:resolver', async() =>{
    expect(await resolvePubkey("erik@arcade.chat")).toEqual("e6c2116f0cf0ac908c5637b3bb7868f3bf12fb02d1f6e3453969ea205b739069")
    expect(await resolvePubkey("@erik")).toEqual("e6c2116f0cf0ac908c5637b3bb7868f3bf12fb02d1f6e3453969ea205b739069")
    expect(await resolvePubkey("simulx@iris.to")).toEqual("3ef7277dc0870c8c07df0ee66829928301eb95785715a14f032aca534862bae0")
    expect(await resolvePubkey("@fiatjaf.com")).toEqual("3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d")
    expect(await resolvePubkey("e6c2116f0cf0ac908c5637b3bb7868f3bf12fb02d1f6e3453969ea205b739069")).toEqual("e6c2116f0cf0ac908c5637b3bb7868f3bf12fb02d1f6e3453969ea205b739069")
    expect(await resolvePubkey("npub18mmjwlwqsuxgcp7lpmnxs2vjsvq7h9tc2u26zncr9t99xjrzhtsqwx4vcz")).toEqual("3ef7277dc0870c8c07df0ee66829928301eb95785715a14f032aca534862bae0")
})