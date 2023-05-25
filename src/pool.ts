import { ArcadeDb } from './db';
import { ArcadeIdentity, NostrEvent, UnsignedEvent } from './ident';
import { SimplePool, Filter, SubscriptionOptions, Sub, Pub } from 'nostr-tools';

interface SubInfo {
  sub: Sub;
  eose_seen: boolean;
  cbs: Set<(event: NostrEvent) => void>;
  last_hit: number;
}

// very thin wrapper using SimplePool + ArcadeIdentity
export class NostrPool {
  ident: ArcadeIdentity;

  relays: string[] = [];
  unsupportedRelays: string[] = [];

  private eventCallbacks: ((event: NostrEvent) => void)[] = [];
  private pool;
  watch: Sub;
  db: ArcadeDb | undefined;
  filters: Map<string, SubInfo>;

  constructor(ident: ArcadeIdentity, db?: ArcadeDb) {
    this.ident = ident;
    const pool = new SimplePool();
    this.pool = pool;
    this.db = db;
    this.filters = new Map<string, SubInfo>();
  }

  async list(
    filters: Filter[],
    opts?: SubscriptionOptions
  ): Promise<NostrEvent[]> {
    if (this.db) {
      // subscribe if needed, wait for eose
      // save to db && return from db
      await new Promise<void>((res, rej) => {
        try {
          this.sub(
            filters,
            async (ev) => {
              await this.db?.saveEvent(ev);
            },
            async () => {
              res();
            }
          );
        } catch (e) {
          rej(e);
        }
      });
      return await this.db.list(filters);
    } else {
      // subsccribe to save events
      return await this.pool.list(this.relays, filters, opts);
    }
  }

  async setRelays(relays: string[]): Promise<void> {
    this.relays = relays;
    await Promise.all(
      relays.map((url) => {
        this.pool.ensureRelay(url);
      })
    );
  }

  close() {
    this.pool.close(this.relays);
  }

  async setAndCheckRelays(relays: string[], nips: number[]): Promise<void> {
    const responses = relays.map((url) => {
      const nip11url = url.replace('wss:', 'https:').replace('ws:', 'http:');
      const ret: [string, Promise<Response>] = [
        url,
        fetch(nip11url, {
          headers: { Accept: 'application/nostr+json' },
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

  start(filter: Filter[], opts?: SubscriptionOptions): void {
    // todo webworker support: https://github.com/adamritter/nostr-relaypool-ts
    this.watch = this.pool.sub(this.relays, filter, opts);
    this.eventCallbacks.map((cb) => this.watch.on('event', cb));
  }

  unsub(callback: (event: NostrEvent) => void) {
    for (const [fil, ent] of this.filters.entries()) {
      ent.cbs.delete(callback);
      if (!ent.cbs) {
        this.filters.delete(fil);
      }
    }
  }

  sub(
    filters: Filter[],
    callback: (event: NostrEvent) => void,
    eose?: () => Promise<void>
  ): void {
    // subcribe to filters
    // maintain filter-subscription map
    // get callbacks on new events
    // optionally get callbacks on eose
    const new_filters: Filter[] = [];
    const old_filters: SubInfo[] = [];
    filters.forEach((f) => {
      const has = this.filters.get(JSON.stringify(f));
      if (has) old_filters.push(has);
      else new_filters.push(f);
    });
    const now = Date.now();
    if (new_filters.length) {
      const sub = this.pool.sub(this.relays, new_filters);
      new_filters.forEach((f) => {
        const cbs = new Set<(event: NostrEvent) => void>();
        cbs.add(callback);
        const dat = { sub: sub, eose_seen: false, cbs, last_hit: now };
        this.filters.set(JSON.stringify(f), dat);
        sub.on('eose', () => {
          dat.eose_seen = true;
          if (eose) eose();
        });
        sub.on('event', (ev) => {
          dat.cbs.forEach((sub) => {
            sub(ev);
          });
        });
      });
    }
    old_filters.forEach((dat) => {
      if (dat) {
        if (eose) {
          if (dat.eose_seen) eose();
          else dat.sub.on('eose', eose);
        }
        dat.cbs.add(callback);
        dat.last_hit = now;
      }
    });
  }

  stop() {
    this.watch.unsub();
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
    await this.db?.saveEvent(event);
    return [event, this.pool.publish(this.relays, event)] as [NostrEvent, Pub];
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
