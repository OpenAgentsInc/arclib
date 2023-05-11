require('websocket-polyfill')

import { nip19, generatePrivateKey } from 'nostr-tools'

import {
  NostrPool,
  ArcadeIdentity,
  NostrEvent,
} from '../src'

const relays = [
  'wss://relay.damus.io/',
  'wss://relay.nostr.bg/',
  'wss://nostr.fmt.wiz.biz/',
  'wss://relay.nostr.band/',
  'wss://nos.lol/'
]

const priv = generatePrivateKey()
const nsec = nip19.nsecEncode(priv)
const ident = new ArcadeIdentity(nsec, "", "")

describe('NostrPool', () => {
    it('can send and receive', async () => {
        const pool = new NostrPool(ident)
        const received: NostrEvent[] = []
        pool.addEventCallback((ev)=>{received.push(ev)})
        await pool.setRelays(relays, [1])
        await pool.send({content: "yo", tags: [], kind: 22345})

        await new Promise(resolve => setTimeout(resolve, 1500))

        expect(received).toHaveLength(1)
    }, 60000)
})
