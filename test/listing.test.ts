/* eslint-disable @typescript-eslint/no-explicit-any */

require('websocket-polyfill');

import NostrMini from 'nostrmini';

import { NostrPool, ArcadeIdentity, ArcadeListings } from '../src';
import {strict as assert} from 'assert'
import Nip28Channel from '../src/channel';
import { off } from 'process';

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

test('create listing', async () => {
    const pool = new NostrPool(ident);
    await pool.setRelays(relays);
    const channel = new Nip28Channel(pool);
    const group = await channel.create({
      name: 'name',
      about: 'about',
      picture: 'picture',
    });
    const listings = new ArcadeListings(channel, group.id);
    await listings.post({
        type: "l1",
        action: "sell",
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
    expect(await listings.list()).toHaveLength(1);
    const info = (await listings.list())[0]
    assert(info.action == "sell")
    assert(info.geohash == "12345")
    assert(info.content == "in person trade only")
    assert(info.id)
    assert(info.created_at)
    assert(info.expiration == 60 * 20)

    const offer = await listings.postOffer({
      type: "o1",
      listing_id: info.id,
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
    pool.close()
});
