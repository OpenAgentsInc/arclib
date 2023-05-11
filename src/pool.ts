import { ArcadeIdentity, NostrEvent, UnsignedEvent } from './ident';
import { SimplePool, Filter, SubscriptionOptions, Sub } from 'nostr-tools';

// i don't know why this is necessary
type FilterType = typeof Filter;
type SubType = typeof Sub;
type SubscriptionOptionsType = typeof SubscriptionOptions;

// very thin wrapper using SimplePool + ArcadeIdentity
export class NostrPool {
  ident: ArcadeIdentity;

  relays: string[] = [];
  unsupportedRelays: string[] = [];

  private eventCallbacks: ((event: NostrEvent) => void)[] = [];
  private pool;
  public sub: (
    relays: string[],
    filters: FilterType[],
    opts?: SubscriptionOptionsType
  ) => SubType;

  constructor(ident: ArcadeIdentity) {
    this.ident = ident;
    const pool = new SimplePool();
    this.sub = pool.sub;
    this.pool = pool;
  }

  async list(
    filter: FilterType[],
    opts?: SubscriptionOptionsType
  ): Promise<NostrEvent[]> {
    return await this.pool.list(this.relays, filter, opts);
  }

  async setRelays(relays: string[]): Promise<void> {
    this.relays = relays;
    await Promise.all(
      relays.map((url) => {
        this.pool.ensureRelay(url);
      })
    );
  }

  async setAndCheckRelays(relays: string[], nips: number[]): Promise<void> {
    const responses = relays.map((url) => {
      const nip11url = url.replace('wss:', 'https:').replace('ws:', 'http:');
      const ret: [string, Promise<Response>] = [
        url,
        fetch(nip11url, {
          headers: new Headers({ Accept: 'application/nostr+json' }),
        }),
      ];
      return ret;
    });

    const urls: string[] = [];
    const unsup: string[] = [];

    for (const [url, resp] of responses) {
      try {
        const info = await (await resp).json();
        if (nips.every((nip) => info.supported_nips?.includes(nip))) {
          urls.push(url);
        } else {
          unsup.push(url);
        }
      } catch (e) {
        console.log(`${e}: can't connect to ${url}`);
        unsup.push(url);
      }
    }

    this.relays = urls;
    this.unsupportedRelays = unsup;
    await Promise.all(
      relays.map((url) => {
        return this.pool.ensureRelay(url);
      })
    );
  }

  /**
   * Starts a subscription with a filter and optional options, and adds event callbacks to
   * the subscription.
   * @param {Filter} filter - tags, etc
   * @param {SubscriptionOptions} [opts] - SubscriptionOptions
   */

  start(filter: typeof Filter, opts?: typeof SubscriptionOptions): void {
    // todo webworker support: https://github.com/adamritter/nostr-relaypool-ts
    const s = this.pool.sub(this.relays, filter, opts);
    this.eventCallbacks.map((cb) => s.on('event', cb));
  }

  seenOn(id: string): string[] {
    return this.pool.seenOn(id);
  }

  /**
   * Publishes an event and returns the event along with a subscription object to watch
   * @param {UnsignedEvent} message - The `message` parameter is an `UnsignedEvent` object, which
   * represents an event that has not yet been signed by the identity of the publisher
   * @returns An array containing an `Event` object and a subscription object to watch for publication.
   */
  async publish(message: UnsignedEvent) {
    const event: NostrEvent = await this.ident.signEvent(message);
    return [event, this.pool.publish(this.relays, event)];
  }

  /**
   * This is an asynchronous function that sends an unsigned event and waits for it to be published,
   * returning the event once it has been successfully sent to at least 1 relay.
   * @param {UnsignedEvent} message - The message parameter is of type UnsignedEvent
   */
  async send(message: UnsignedEvent): Promise<NostrEvent> {
    const [event, pubs] = await this.publish(message);
    return new Promise<NostrEvent>((res) => {
      pubs.on('ok', () => {
        res(event);
      });
    });
  }

  /**
   * This function adds a callback function to an array of event callbacks.
   * @param callback - Callback that takes an event of type NostrEvent as its parameter
   */
  addEventCallback(callback: (event: NostrEvent) => void): void {
    this.eventCallbacks.push(callback);
  }
}
