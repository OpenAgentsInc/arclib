require('websocket-polyfill')

import { nip19, generatePrivateKey } from 'nostr-tools'

import {
  NostrPool,
  ArcadeIdentity,
} from '../src'


const relays = [
//  'ws://127.0.0.1:3333',
  'wss://relay.nostr.band/',
  'wss://nos.lol/',
]

const priv = generatePrivateKey()
const nsec = nip19.nsecEncode(priv)
const ident = new ArcadeIdentity(nsec, "", "")

function defer() {
  const deferred: any = {};
  deferred.promise = new Promise<any>((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
  });
  return deferred;
}

function waiter(delay=5000) {
  const deferred = defer()
  setTimeout(()=>{deferred.reject("timed out")}, delay)
  return [deferred.resolve, deferred.promise] as [(res: any)=>any, Promise<any>]
}

function sleep(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

describe('NostrPool', () => {
    it('can send and receive', async () => {
        const pool = new NostrPool(ident)
        await pool.setRelays(relays)
        const [resolver, wait] = waiter(9000)
        pool.addEventCallback((ev)=>{resolver(ev)})
        const event = await pool.send({content: "yo", tags: [], kind: 1})
        await sleep(1000) 
        await pool.start([{authors: [ident.pubKey]}])
        console.log("req started")
        console.log("sent event, waiting for reply", event)
        await wait
    }, 10000)
})
