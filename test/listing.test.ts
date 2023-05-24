/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');
Object.assign(global, { crypto: require('crypto') });

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity, ArcadeListings } from '../src';
import {strict as assert} from 'assert'
import Nip28Channel from '../src/channel';

// const relays = ['wss://relay.nostr.band/', 'wss://nos.lol/'];

const ident = ArcadeIdentity.generate();

const srv = new NostrMini();
const relays: string[] = []

beforeAll(() => {
  const port: number = srv.listen(0).address().port;
  relays.push(`ws://127.0.0.1:${port}`)
});

afterAll(async () => {
  await srv.close();
});

interface CreateArgs {
  pool: NostrPool
  action?: "buy" | "sell";
} 

async function createListing({pool, action = "sell"}: CreateArgs) : Promise<any> {
    const channel = new Nip28Channel(pool);
    const group = await channel.create({
      name: 'name',
      about: 'about',
      picture: 'picture',
    });
    const listings = new ArcadeListings(channel, group.id);
    const ev = await listings.post({
        type: "l1",
        action: action,
        item: "bitcoin",
        content: "in person trade only",
        amt: 1,
        min_amt: 0.2,
        payments: ["in person"],
        currency: "usd",
        price: 28000,
        expiration: "20 min",
        geohash: "1234567890"
    })
    const info = (await listings.list({ids: [ev.id as string]}))[0]
    expect(info).toBeTruthy()
    return [listings, info]
} 

test('create listing', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const [listings, info] = await createListing({pool})
    assert(info.action == "sell")
    assert(info.geohash == "12345")
    assert(info.content == "in person trade only")
    assert(info.id)
    assert(info.created_at)
    assert(info.expiration == 60 * 20)

    const offer = await listings.postOffer({
      type: "o1",
      listing_id: info.id,
      content: "offer",
      price: 28000,
      amt: 1,
      payment: "in person",
      expiration: "1 week",
      geohash: "12345678"
    })

   
    const offer2 = (await listings.listOffers(info.id))[0]
    assert(offer2.id == offer.id)
    assert(offer2.amt == 1)
    assert(offer2.price == 28000)
    assert(offer2.expiration == 7 * 86400)
    assert(offer2.created_at)
    assert(offer2.geohash == "12345")
    assert(offer2.public == true)

    const action = await listings.postAction({
      type: "a1",
      action: "accept",
      offer_id: offer2.id,
      content: "ok, lets meet",
    })
    
    const action2 = (await listings.listActions(offer2.id))[0]
    assert(action2.id == action.id)
    assert(action2.action == "accept")
    assert(action2.public == true)
    pool.close()
});

test("listing: create private", async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const [listings, info] = await createListing({pool})

    const offer = await listings.postOffer({
      type: "o1",
      content: "offer",
      listing_id: info.id,
      listing_pubkey: info.pubkey,
      price: 28000,
      amt: 1,
      payment: "in person",
      expiration: "1 week",
      geohash: "12345678"
    })

    const offer2 = (await listings.listOffers(info.id, {ids: [offer.id]}))[0]
    assert(offer2.id == offer.id)
    assert(offer2.amt == 1)
    assert(offer2.price == 28000)
    assert(offer2.expiration == 7 * 86400)
    assert(offer2.created_at)
    assert(offer2.geohash == "12345")
    assert(offer2.public == false)

    const action = await listings.postAction({
      type: "a1",
      action: "accept",
      reply_pubkey: offer2.pubkey,
      offer_id: offer2.id,
      content: "ok, lets meet",
    })

    const action2 = (await listings.listActions(offer2.id, {ids: [action.id]}))[0]
    assert(action2.id == action.id)
    assert(action2.action == "accept")
    assert(action2.public == false)
    pool.close()
  })