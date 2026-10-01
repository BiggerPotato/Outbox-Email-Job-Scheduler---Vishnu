import { Client } from '@elastic/elasticsearch';
import { config } from './config.js';
import { pool } from './db.js';

export const elastic = new Client({ node: config.elasticUrl });
export async function ensureEmailIndex() {
  const exists = await elastic.indices.exists({ index: config.elasticIndex });
  if (!exists) await elastic.indices.create({ index: config.elasticIndex, mappings: { properties: {
    id: { type: 'keyword' }, userId: { type: 'keyword' }, senderId: { type: 'keyword' }, recipient: { type: 'search_as_you_type' },
    subject: { type: 'search_as_you_type' }, body: { type: 'text' }, status: { type: 'keyword' },
    scheduledAt: { type: 'date' }, sentAt: { type: 'date' }, createdAt: { type: 'date' }, senderName: { type: 'keyword' },
    previewUrl: { type: 'keyword', index: false }, failureReason: { type: 'text', index: false }, error: { type: 'text', index: false },
  } } });
  const records = await pool.query(`SELECT e.id,e.user_id,e.sender_id,e.recipient,e.subject,e.body,e.status,e.scheduled_at,e.sent_at,e.created_at,
    e.preview_url,e.failure_reason,s.name AS sender_name FROM scheduled_emails e JOIN senders s ON s.id=e.sender_id ORDER BY e.created_at`);
  for (let start = 0; start < records.rows.length; start += 500) await indexEmails(records.rows.slice(start, start + 500));
}

function documentFor(row: Record<string, any>) {
  return {
    id: String(row.id), userId: String(row.user_id), senderId: row.sender_id, recipient: row.recipient,
    subject: row.subject, body: row.body, status: row.status,
    scheduledAt: row.scheduled_at, sentAt: row.sent_at, createdAt: row.created_at,
    senderName: row.sender_name ?? row.sender_id, previewUrl: row.preview_url ?? null,
    failureReason: row.failure_reason ?? null, error: row.failure_reason ?? null,
  };
}

export async function indexEmail(row: Record<string, any>) {
  return indexEmails([row]);
}

export async function indexEmails(rows: Record<string, any>[]) {
  if (!rows.length) return;
  const operations = rows.flatMap((row) => [
    { index: { _index: config.elasticIndex, _id: String(row.id) } },
    documentFor(row),
  ]);
  const result = await elastic.bulk({ operations, refresh: 'wait_for' });
  if (result.errors) {
    const failed = result.items.filter((item) => item.index?.error).length;
    throw new Error(`Elasticsearch failed to index ${failed} email record(s).`);
  }
}

export async function removeEmailFromIndex(id: string) {
  await elastic.delete({ index: config.elasticIndex, id, refresh: 'wait_for' }).catch((error) => {
    if (error.meta?.statusCode !== 404) throw error;
  });
}
