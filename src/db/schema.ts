import { appSchema, tableSchema } from '@nozbe/watermelondb';

export enum TableName {
  EVENTS = 'events',
}

export const AppSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TableName.EVENTS,
      columns: [
        // id is taken as a name
        { name: 'event_id', type: 'string', isIndexed: true },
        { name: 'pubkey', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'sig', type: 'string' },
        { name: 'kind', type: 'number', isIndexed: true },
        { name: 'tags', type: 'string' },
        { name: 'p1', type: 'string', isIndexed: true },
        { name: 'e1', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'verified', type: 'boolean' },
      ],
    }),
  ],
});
