import { pool } from './db.js';
import { decrypt } from './security.js';

export async function notifyHourlyLimit(userId: string, senderName: string, limit: number, windowStart: number) {
  const connection = await pool.query('SELECT access_token,slack_user_id FROM slack_connections WHERE user_id=$1', [userId]);
  if (!connection.rowCount) return;
  const token = decrypt(connection.rows[0].access_token as string);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' };
  const opened = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST', headers, body: JSON.stringify({ users: connection.rows[0].slack_user_id }),
  });
  const openResult = await opened.json() as { ok: boolean; channel?: { id: string }; error?: string };
  if (!openResult.ok || !openResult.channel?.id) throw new Error(`Slack conversations.open failed: ${openResult.error ?? opened.status}`);
  const sent = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST', headers,
    body: JSON.stringify({ channel: openResult.channel.id, text: `ReachInbox scheduler: sender *${senderName}* reached its limit of ${limit} emails per hour at ${new Date(windowStart).toISOString()}. Remaining emails have been moved to the next available hour.` }),
  });
  const result = await sent.json() as { ok: boolean; error?: string };
  if (!result.ok) throw new Error(`Slack chat.postMessage failed: ${result.error ?? sent.status}`);
}
