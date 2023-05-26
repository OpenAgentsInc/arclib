import { Collection, Database, Model, Q } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { AppSchema, TableName } from './schema';
import { NostrEvent } from '../ident';
import { Filter } from 'nostr-tools';
import { Mutex } from 'async-mutex'

const mutex = new Mutex()

export class DbEvent extends Model {
  static table = TableName.EVENTS;

  @field('event_id') event_id: string;
  @text('content') content!: string;
  @text('sig') sig: string;
  @field('kind') kind: number;
  @text('pubkey') pubkey: string;
  @json('tags', (rawTags): string[][] => {
    return Array.isArray(rawTags) ? rawTags : [];
  })
  tags: string[][];
  @field('created_at') created_at: number;
  @field('verified') verified: boolean;
  @field('e1') e1: string;
  @field('p1') p1: string;

  public static async fromEvent(
    db: Database,
    event: NostrEvent,
    verified = false
  ): Promise<DbEvent> {
    const posts: Collection<DbEvent> = db.collections.get(DbEvent.table);
    return mutex.runExclusive(async () => {
      return await db.write(async () => {
        const have = await posts.query(Q.where('event_id', event.id)).fetch();
        if (have.length) {
          return have[0] as DbEvent;
        }
        return await posts.create((post: DbEvent) => {
          post.event_id = event.id;
          post.content = event.content;
          post.sig = event.sig;
          post.kind = event.kind;
          post.tags = event.tags;
          post.pubkey = event.pubkey;
          post.created_at = event.created_at;
          post.verified = verified;
          event.tags.forEach((tag) => {
            if (tag[0] == 'e' && !post.e1) {
              post.e1 = tag[1];
            }
            if (tag[0] == 'p' && !post.p1) {
              post.p1 = tag[1];
            }
          });
        });
      });
    });
  }

  asEvent(): NostrEvent {
    return {
      id: this.event_id,
      kind: this.kind,
      pubkey: this.pubkey,
      sig: this.sig,
      content: this.content,
      tags: this.tags,
      created_at: this.created_at,
    };
  }
}

export class ArcadeDb extends Database {
  async list(filter: Filter[]): Promise<NostrEvent[]> {
    const posts: Collection<DbEvent> = this.collections.get(DbEvent.table);
    const or: Q.Where = this.filterToQuery(filter);
    const records = await posts.query(or).fetch();
    const els = records.map((ev: DbEvent) => {
      return ev.asEvent();
    });
    return els;
  }

  async latest(filter: Filter[]): Promise<number> {
    const posts: Collection<DbEvent> = this.collections.get(DbEvent.table);
    const or: Q.Where = this.filterToQuery(filter);
    const records = await posts.query(or).fetch();
    return records.reduce((prev, cur)=>{
        return (!prev || cur.created_at > prev.created_at) ? cur : prev
    }).created_at
  }

  private filterToQuery(filter: Filter[]) {
    const or: Q.Where[] = [];
    filter.forEach((f) => {
      const and: Q.Where[] = [];
      f.authors?.map((el: string) => {
        and.push(Q.where('pubkey', Q.eq(el)));
      });
      f.ids?.map((el: string) => {
        and.push(Q.where('event_id', Q.eq(el)));
      });
      f.kinds?.map((el: number) => {
        and.push(Q.where('kind', Q.eq(el)));
      });
      f['#e']?.map((el: string) => {
        and.push(Q.where('e1', Q.eq(el)));
      });
      f['#p']?.map((el: string) => {
        and.push(Q.where('p1', Q.eq(el)));
      });
      or.push(Q.and(...and));
    });
    return Q.or(...or);
  }

  async saveEvent(ev: NostrEvent) {
    return await DbEvent.fromEvent(this, ev);
  }
}

export function connectDb(): ArcadeDb {
  const adapter = new SQLiteAdapter({
    schema: AppSchema,
    migrations: schemaMigrations({
      migrations: [],
    }),
    onSetUpError: (error): void => {
      console.log('setup error', error);
    },
  });

  const db = new ArcadeDb({
    adapter,
    modelClasses: [DbEvent],
  });

  return db;
}
