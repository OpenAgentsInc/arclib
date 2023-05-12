import { connectDb, Post } from '../src/db';

describe('loadPosts', () => {
  it('can can write and read channel posts', async () => {
    const event1 = {
      kind: 1,
      tags: [['tag1'], ['tag2']],
      content: 'test-content',
      id: 'test-id1',
      pubkey: 'test-pk',
      sig: 'test-sig',
      created_at: 1,
    };
    const event2 = {
      kind: 1,
      tags: [['tag1'], ['tag2']],
      content: 'test-content',
      id: 'test-id2',
      pubkey: 'test-pk',
      sig: 'test-sig',
      created_at: 1,
    };
    const db = connectDb();
    const p1 = await Post.fromEvent(db, event1);
    const p2 = await Post.fromEvent(db, event2);
    expect(p1.event_id).toEqual('test-id1');
    expect(p2.event_id).toEqual('test-id2');
  });
});
