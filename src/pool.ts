import { ArcadeIdentity, NostrEvent, UnsignedEvent } from "./ident";
import {SimplePool, Filter, SubscriptionOptions} from 'nostr-tools'


// very thin wrapper using SimplePool + ArcadeIdentity
export class NostrPool {
  ident: ArcadeIdentity
  
  relays: string[] = []
  unsupportedRelays: string[] = [];
  
  private eventCallbacks: ((event: NostrEvent) => void)[] = [];
  private pool: typeof SimplePool

  constructor(ident: ArcadeIdentity) {
    this.ident = ident
    this.pool = new SimplePool()
  }

/**
 * This function sets relays based on their supported NIPs and ensures their availability in a pool.
 * @param {string[]} relays - an array of strings representing URLs of relays
 * @param {number[]} nips - `nips` is an array of numbers representing the Network Identifier Prefixes
 * (NIPs) that the relays should support. The function `setRelays` takes in an array of relay URLs and
 * checks if each relay supports all the NIPs in the `nips` array.
 */
  async setRelays(relays: string[], nips: number[]): Promise<void> {
    const responses = relays.map((url)=>{
      url = url.replace("wss:", "https:")
      const ret : [string, Promise<Response>] = [url, fetch(url, {headers: new Headers({"Accept": "application/nostr+json"})})]
      return ret
    })
    
    const urls: string[] = []
    const unsup: string[] = []

    for (const [url, resp] of responses) {
      try {
        const info = await (await resp).json()
        console.log(`${url} info`, info)
        if (nips.every((nip)=>info.supportedNips.includes(nip))) {
          urls.push(url)
        } else {
          unsup.push(url)
        }
      } catch (e) {
        console.log(`${e}: can't connect to ${url}`)
        unsup.push(url)
      }
    }

    this.relays = urls;
    this.unsupportedRelays = unsup;
    await Promise.all(relays.map(url => {this.pool.ensureRelay(url)}))
  }
/**
 * Starts a subscription with a filter and optional options, and adds event callbacks to
 * the subscription.
 * @param {Filter} filter - tags, etc
 * @param {SubscriptionOptions} [opts] - SubscriptionOptions
 */

  start(filter: typeof Filter, opts?: typeof SubscriptionOptions): void {
    // todo webworker support: https://github.com/adamritter/nostr-relaypool-ts
    const s = this.pool.sub(this.relays, filter, opts)
    this.eventCallbacks.map((cb)=>s.on("event", cb))
  }

  seenOn(id: string): string[] {
      return this.pool.seenOn(id)
  }

  /**
   * Publishes an event and returns the event along with a subscription object to watch
   * @param {UnsignedEvent} message - The `message` parameter is an `UnsignedEvent` object, which
   * represents an event that has not yet been signed by the identity of the publisher
   * @returns An array containing an `Event` object and a subscription object to watch for publication.
   */
  async pub(message: UnsignedEvent) {
    const event: NostrEvent = await this.ident.signEvent(message)
    return [event, this.pool.publish(this.relays, event)]
  }

/**
 * This is an asynchronous function that sends an unsigned event and waits for it to be published,
 * returning the event once it has been successfully sent.
 * @param {UnsignedEvent} message - The message parameter is of type UnsignedEvent
 */
  async send(message: UnsignedEvent): Promise<NostrEvent> {
    const [event, pubs] = await this.pub(message)
    return new Promise<NostrEvent>((res) => {
      pubs.on('ok', res(event))
    }) 
  }

/**
 * This function adds a callback function to an array of event callbacks.
 * @param callback - Callback that takes an event of type NostrEvent as its parameter
 */
  addEventCallback(callback: (event: NostrEvent) => void): void {
    this.eventCallbacks.push(callback);
  }
}

