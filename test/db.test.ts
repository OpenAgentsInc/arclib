import { connectDb } from '../src/db';

describe('db: load events', () => {
  it('can can write and read events', async () => {
    const event1 = {
      kind: 1,
      tags: [['tag1'], ['tag2'], ['e', 'reply-to1']],
      content: 'test-content1',
      id: 'test-id1',
      pubkey: 'test-pk',
      sig: 'test-sig',
      created_at: 1,
    };
    const event2 = {
      kind: 1,
      tags: [['tag1'], ['tag2']],
      content: 'test-content2',
      id: 'test-id2',
      pubkey: 'test-pk',
      sig: 'test-sig',
      created_at: 1,
    };
    const db = connectDb();
    await db.saveEventSync(event1);
    await db.saveEventSync(event2);
    console.log('query with a filter');

    expect((await db.list([{ ids: [event1.id] }]))[0].content).toEqual(
      'test-content1'
    );
    expect((await db.list([{ ids: [event1.id] }]))[0].tags).toEqual([['tag1'],['tag2'],['e','reply-to1']]);

    // test oneOf
    expect((await db.list([{ ids: [event1.id, event2.id] }])).length).toEqual(2);

    expect((await db.list([{ '#e': ['reply-to1'] }]))[0].content).toEqual(
      'test-content1'
    );
  });
});
