import { appSchema, tableSchema } from '@nozbe/watermelondb';

export enum TableName {
  CHANNELS = 'channels',
  POSTS = 'posts',
  USERS = 'users',
}

export const AppSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TableName.USERS,
      columns: [
        { name: 'event_id', type: 'string', isIndexed: true },
        { name: 'kind0', type: 'string' },
      ],
    }),
    tableSchema({
      name: TableName.CHANNELS,
      columns: [
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'about', type: 'string' },
        { name: 'picture', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'last_sync', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: TableName.POSTS,
      columns: [
        { name: 'event_id', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'tags', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'verified', type: 'boolean' },
        { name: 'parent_id', type: 'string', isIndexed: true },
        { name: 'channel_id', type: 'string', isIndexed: true },
        { name: 'author_id', type: 'string', isIndexed: true },
      ],
    }),
  ],
});
