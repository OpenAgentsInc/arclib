import { connectDb, DbEvent } from '../src/db';

describe('db: load events', () => {
  it('can can write and read events', async () => {
    const event1 = {
      kind: 1,
      tags: [['tag1'], ['tag2'], ["e", "reply-to1"]],
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
    const p1 = await DbEvent.fromEvent(db, event1);
    const p2 = await DbEvent.fromEvent(db, event2);
    expect(p1.event_id).toEqual('test-id1');
    expect(p2.event_id).toEqual('test-id2');

    console.log("query with a filter")

    expect((await db.list([{ids: [event1.id]}]))[0].content).toEqual("test-content1")
    expect((await db.list([{"#e": ["reply-to1"]}]))[0].content).toEqual("test-content1")
  });
});
