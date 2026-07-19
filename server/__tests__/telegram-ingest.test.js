import { describe, it, expect, vi } from 'vitest';

import {
  getUpdates,
  extractJobMessages,
  selectFreshJobs,
  markIngested,
  textFingerprint,
} from '../community/telegramIngest.js';
import { formatRepostMessage } from '../community/telegramRepost.js';

const JOB_TEXT = 'Urgent hiring: Sales Executive\nLocation: Dubai\nSend CV to hr@acme.ae';

function update(id, message) {
  return { update_id: id, message };
}

const groupMsg = (over = {}) => ({
  message_id: 101,
  date: 1784500000,
  chat: { id: -100555, type: 'supergroup', title: 'WePostJobs', username: 'WePostJobs' },
  from: { id: 7, is_bot: false, first_name: 'A' },
  text: JOB_TEXT,
  ...over,
});

describe('telegram ingest — extractJobMessages', () => {
  it('keeps job posts and advances the offset past the last update', () => {
    const { jobs, nextOffset } = extractJobMessages([update(10, groupMsg()), update(12, groupMsg({ message_id: 102 }))]);
    expect(jobs).toHaveLength(2);
    expect(nextOffset).toBe(13);
  });

  it('skips bot-authored, destination-chat, media-only and non-job messages', () => {
    const updates = [
      update(1, groupMsg({ from: { id: 9, is_bot: true } })), // our own repost echo
      update(2, groupMsg({ chat: { id: -100999, title: 'My group' } })), // destination chat
      update(3, groupMsg({ text: undefined })), // sticker/photo without caption
      update(4, groupMsg({ text: 'Good morning everyone!' })), // chatter
      update(5, groupMsg({ message_id: 200 })), // the one real job
    ];
    const { jobs, nextOffset } = extractJobMessages(updates, { destChatId: '-100999' });
    expect(jobs.map((j) => j.key)).toEqual(['-100555:200']);
    expect(nextOffset).toBe(6);
  });

  it('builds a permalink for public chats and none for private forwards', () => {
    const pub = extractJobMessages([update(1, groupMsg())]).jobs[0];
    expect(pub.listing.url).toBe('https://t.me/WePostJobs/101');
    expect(pub.listing.source).toBe('telegram');
    expect(pub.listing.applyEmail).toBe('hr@acme.ae');

    const fwd = extractJobMessages([
      update(2, groupMsg({
        chat: { id: 42, type: 'private' },
        forward_origin: { type: 'chat', chat: { id: -1, title: 'Dubai Jobs Group' } },
      })),
    ]).jobs[0];
    expect(fwd.listing.url).toBe('');
    expect(fwd.sourceLabel).toBe('Dubai Jobs Group');
  });

  it('reads caption when a post is a photo with caption', () => {
    const { jobs } = extractJobMessages([update(1, groupMsg({ text: undefined, caption: JOB_TEXT }))]);
    expect(jobs).toHaveLength(1);
  });
});

describe('telegram ingest — dedupe and state', () => {
  const job = (key, text = JOB_TEXT) => ({ key, fingerprint: textFingerprint(text), sourceLabel: 'X', listing: {} });

  it('drops already-posted keys and identical text forwarded twice', () => {
    const state = { postedKeys: ['a:1'], fingerprints: [] };
    const fresh = selectFreshJobs([job('a:1'), job('b:2'), job('c:3')], state, { limit: 10 });
    // b:2 and c:3 share the same text — only the first survives.
    expect(fresh.map((j) => j.key)).toEqual(['b:2']);
  });

  it('markIngested records keys + fingerprints and bounds the tails', () => {
    const next = markIngested({ postedKeys: ['old'], fingerprints: ['f0'] }, [job('n:1')], { keep: 2 });
    expect(next.postedKeys).toEqual(['old', 'n:1']);
    expect(next.fingerprints).toHaveLength(2);
  });
});

describe('telegram ingest — repost formatting without a permalink', () => {
  it('credits the source by name when there is no public URL', () => {
    const { jobs } = extractJobMessages([
      update(1, groupMsg({ chat: { id: 42, type: 'private' }, forward_origin: { type: 'chat', chat: { id: -1, title: 'Dubai Jobs' } } })),
    ]);
    const text = formatRepostMessage(jobs[0].listing, { sourceLabel: jobs[0].sourceLabel });
    expect(text).toContain('📢 via Dubai Jobs');
    expect(text).not.toContain('<a href');
  });
});

describe('telegram ingest — getUpdates', () => {
  it('calls the Bot API with offset and surfaces API errors', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, result: [update(1, groupMsg())] }) }));
    const result = await getUpdates({ token: 't0k', offset: 5, fetchImpl: ok });
    expect(result).toHaveLength(1);
    expect(ok.mock.calls[0][0]).toContain('/bott0k/getUpdates');
    expect(ok.mock.calls[0][0]).toContain('offset=5');

    const bad = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ ok: false, description: 'webhook is active' }) }));
    await expect(getUpdates({ token: 't', fetchImpl: bad })).rejects.toThrow(/webhook is active/);
  });
});
