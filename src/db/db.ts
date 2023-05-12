import {
  Collection,
  Database,
  Model,
  Query,
  Relation,
} from '@nozbe/watermelondb';
import {
  children,
  field,
  relation,
  text,
  json,
} from '@nozbe/watermelondb/decorators';
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Associations } from '@nozbe/watermelondb/Model';
import { AppSchema, TableName } from './schema';
import { NostrEvent } from '../ident';

class User extends Model {
  static table = TableName.USERS;

  @field('pubkey') pubkey: string;
  @json('kind0', (rawJs) => {
    return rawJs ? rawJs : {};
  })
  kind0: string;
}

class Channel extends Model {
  static table = TableName.CHANNELS;

  static associations: Associations = {
    [TableName.POSTS]: { type: 'has_many', foreignKey: 'channel_id' },
  };

  @field('event_id') event_id: string;
  @text('name') name: string;
  @text('about') about: string;
  @text('picture') picture: string;
  @field('author_id') author_id: string;
  @field('last_sync') last_sync: number;

  @children(TableName.POSTS) posts!: Query<Post>;
}

export class Post extends Model {
  static table = TableName.POSTS;

  static associations: Associations = {
    [TableName.CHANNELS]: { type: 'belongs_to', key: 'channel_id' },
  };

  @field('event_id') event_id: string;
  @text('content') content!: string;
  @json('tags', (rawTags) => {
    return Array.isArray(rawTags) ? rawTags : [];
  })
  tags: string;
  @field('created_at') created_at: number;
  @field('verified') verified: boolean;
  @field('author_id') author_id: string;
  @field('channel_id') channel_id: string;
  @field('parent_id') parent_id!: string;

  @relation(TableName.CHANNELS, 'channel_id') channel!: Relation<Channel>;

  public static async fromEvent(
    db: Database,
    event: NostrEvent
  ): Promise<Post> {
    const posts: Collection<Post> = db.collections.get(Post.table);
    return await db.write(async () => {
      return await posts.create((post: Post) => {
        post.event_id = event.id;
        post.content = event.content;
        post.tags = JSON.stringify(event.tags);
        post.author_id = event.pubkey;
        post.created_at = event.created_at;
        event.tags.forEach((tag) => {
          if (tag[0] == 'e' && tag[3] == 'root') {
            post.channel_id = tag[1];
          }
          if (tag[0] == 'e' && tag[3] == 'reply') {
            post.parent_id = tag[1];
          }
        });
      });
    });
  }
}

export function connectDb(): Database {
  const adapter = new SQLiteAdapter({
    schema: AppSchema,
    migrations: schemaMigrations({
      migrations: [],
    }),
    onSetUpError: (error): void => {},
  });

  const db = new Database({
    adapter,
    modelClasses: [User, Channel, Post],
  });

  return db;
}
