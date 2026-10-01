import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Papa from 'papaparse';

type User = { id: string; name: string; email: string; avatar: string | null; slackConnected: boolean };
type Sender = { id: string; name: string; maxPerHour: number; minDelaySeconds: number };
type Email = { id: string; recipient: string; subject: string; status: 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'; scheduledAt: string; sentAt: string | null; attempts: number; error: string | null; previewUrl: string | null; createdAt: string; senderName: string };
type ApiError = Error & { fields?: Record<string, string> };

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status})`) as ApiError;
    error.fields = result.fields;
    throw error;
  }
  return result as T;
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
    clock: 'M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    send: 'm22 2-7 20-4-9-9-4Z M22 2 11 13',
    search: 'm21 21-4.4-4.4 M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
    plus: 'M12 5v14 M5 12h14',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    check: 'm5 12 4 4L19 6',
    x: 'M18 6 6 18 M6 6l12 12',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    external: 'M15 3h6v6 M10 14 21 3 M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6',
    slack: 'M14 2v6m0 4v10M10 2v6m0 4v10M2 10h6m4 0h10M2 14h6m4 0h10',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12H2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6',
    bolt: 'm13 2-3 8h7l-6 12 1-9H5l8-11Z',
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.mail} /></svg>;
}

const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<'scheduled' | 'sent' | 'failed'>('scheduled');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [compose, setCompose] = useState(false);
  const [toast, setToast] = useState('');
  const [notice, setNotice] = useState('');
  const [slack, setSlack] = useState<{ connected: boolean; teamName: string | null }>({ connected: false, teamName: null });
  const [servicesOnline, setServicesOnline] = useState(false);

  const flash = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3600); }, []);
  const loadEmails = useCallback(async (status: string, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ state: status, limit: '200' });
      if (search.trim()) params.set('q', search.trim());
      const [data, summary] = await Promise.all([
        api<{ emails: Email[] }>(`/api/emails?${params}`),
        api<{ counts: Record<string, number> }>('/api/emails/summary'),
      ]);
      setEmails(data.emails);
      setCounts(summary.counts);
    } catch (error) { flash((error as Error).message); }
    finally { setLoading(false); }
  }, [flash]);

  const loadWorkspace = useCallback(async () => {
    const [senderData, slackData] = await Promise.all([api<{ senders: Sender[] }>('/api/senders'), api<{ connected: boolean; teamName: string | null }>('/api/slack/status')]);
    setSenders(senderData.senders);
    setSlack(slackData);
  }, []);

  useEffect(() => {
    api<{ user: User | null }>('/api/auth/me').then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadWorkspace().catch((error) => flash((error as Error).message));
  }, [user, loadWorkspace, flash]);

  useEffect(() => {
    if (!user) return;
    const handle = window.setTimeout(() => loadEmails(tab, query), 250);
    return () => window.clearTimeout(handle);
  }, [query, tab, user, loadEmails]);

  useEffect(() => {
    if (!user) return;
    const check = () => api<{ status: string }>('/api/health').then((health) => setServicesOnline(health.status === 'ok')).catch(() => setServicesOnline(false));
    check();
    const timer = window.setInterval(() => { check(); loadEmails(tab, query); }, 15000);
    return () => window.clearInterval(timer);
  }, [user, tab, query, loadEmails]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'connected') setNotice('Slack connected. Hourly limit alerts will be sent to your Slack DM.');
    if (params.get('slack') === 'cancelled') setNotice('Slack connection was cancelled.');
    if (params.has('slack')) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const scheduledCount = (counts.scheduled || 0) + (counts.sending || 0);
  const sentCount = counts.sent || 0;
  const currentItems = emails;

  if (authLoading) return <div className="loading-screen"><div className="brand-symbol">R</div><span className="spinner" /> Loading your workspace…</div>;
  if (!user) return <Login />;

  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); };
  const disconnectSlack = async () => {
    await api('/api/slack/connection', { method: 'DELETE' });
    setSlack({ connected: false, teamName: null });
    flash('Slack disconnected.');
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-symbol">R</span><span>reachinbox<span className="brand-dot">.</span></span></a>
      <div className="side-label">WORKSPACE</div><div className="workspace-switch"><span className="workspace-logo">O</span><span>Outbox Labs</span><span className="chevron">⌄</span></div>
      <div className="side-label nav-label">EMAIL</div>
      <button className="nav-link"><Icon name="grid" /> Overview</button>
      <button className={`nav-link ${tab === 'scheduled' ? 'selected' : ''}`} onClick={() => setTab('scheduled')}><Icon name="clock" /> Scheduled <span className="nav-number">{scheduledCount}</span></button>
      <button className={`nav-link ${tab === 'sent' ? 'selected' : ''}`} onClick={() => setTab('sent')}><Icon name="send" /> Sent</button>
      <div className="side-label nav-label">TOOLS</div>
      <a className="nav-link" href="/api/admin/queues" target="_blank" rel="noreferrer"><Icon name="bolt" /> Live queue <Icon className="tiny-external" name="external" /></a>
      <button className="nav-link" onClick={() => document.getElementById('slack-settings')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Icon name="slack" /> Slack alerts</button>
      <div className="side-foot"><div className="side-foot-copy"><strong>Built for reliable delivery</strong><span>Powered by BullMQ + Redis</span></div><div className="side-foot-icon"><Icon name="bolt" /></div></div>
      <div className="side-user"><Avatar user={user} /><div className="side-user-info"><strong>{user.name}</strong><span>{user.email}</span></div><button className="logout-icon" onClick={logout} title="Log out">↪</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="mobile-brand"><span className="brand-symbol">R</span> reachinbox</div><div className="crumb">Email <span>/</span> <strong>{tab === 'scheduled' ? 'Scheduled emails' : tab === 'sent' ? 'Sent emails' : 'Failed emails'}</strong></div><div className="header-user"><span className={`connection ${servicesOnline ? '' : 'offline'}`}><i /> {servicesOnline ? 'Services online' : 'Service unavailable'}</span><Avatar user={user} /><div className="header-user-copy"><strong>{user.name}</strong><span>{user.email}</span></div><button className="text-button" onClick={logout}>Log out</button></div></header>
      <div className="page-wrap">
        <section className="welcome-row"><div><div className="eyebrow">OUTREACH WORKSPACE</div><h1>Email scheduler</h1><p>Plan personalized email delivery with confidence.</p></div><button className="primary-button" onClick={() => setCompose(true)}><Icon name="plus" /> Compose new email</button></section>
        {notice && <div className="notice"><Icon name="check" /> {notice}<button onClick={() => setNotice('')}><Icon name="x" /></button></div>}
        <section className="metric-grid">
          <Metric icon="clock" label="Scheduled emails" value={scheduledCount} color="violet" helper="Waiting in the durable queue" />
          <Metric icon="send" label="Sent emails" value={sentCount} color="green" helper="Captured by Ethereal test SMTP" />
          <Metric icon="slack" label="Slack alerts" value={slack.connected ? 'Connected' : 'Not connected'} color="blue" helper={slack.connected ? `Workspace · ${slack.teamName}` : 'Get notified when a limit is reached'} />
        </section>
        <section className="card email-card">
          <div className="card-heading"><div><h2>{tab === 'scheduled' ? 'Scheduled emails' : tab === 'sent' ? 'Sent emails' : 'Failed emails'}</h2><p>Monitor delivery status and upcoming sends</p></div><div className="heading-actions"><button className="quiet-button" onClick={() => loadEmails(tab, query)}><span>↻</span> Refresh</button><button className="primary-button compact" onClick={() => setCompose(true)}><Icon name="plus" /> New email</button></div></div>
          <div className="list-toolbar"><div className="tabs"><button className={tab === 'scheduled' ? 'tab active' : 'tab'} onClick={() => setTab('scheduled')}>Scheduled</button><button className={tab === 'sent' ? 'tab active' : 'tab'} onClick={() => setTab('sent')}>Sent</button><button className={tab === 'failed' ? 'tab active' : 'tab'} onClick={() => setTab('failed')}>Failed</button></div><label className="searchbox"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search emails" /></label></div>
          <EmailTable items={currentItems} loading={loading} state={tab} onCancel={async (id) => { if (!window.confirm('Cancel this scheduled email?')) return; try { await api(`/api/emails/${id}`, { method: 'DELETE' }); flash('Scheduled email cancelled.'); await loadEmails(tab, query); } catch (error) { flash((error as Error).message); } }} />
          <div className="card-foot"><span>Showing {currentItems.length} {tab === 'scheduled' ? 'scheduled' : tab} email{currentItems.length === 1 ? '' : 's'}</span><span className="updates"><i /> Refreshes automatically</span></div>
        </section>
        <section className="slack-card" id="slack-settings"><div className="slack-icon"><Icon name="slack" /></div><div className="slack-description"><strong>Get notified when a sender hits its hourly limit</strong><span>Connect Slack to receive a direct message when the queue delays a campaign.</span></div>{slack.connected ? <><span className="connected-label"><i /> Connected to {slack.teamName}</span><button className="quiet-button" onClick={disconnectSlack}>Disconnect</button></> : <a className="slack-button" href="/auth/slack"><Icon name="slack" /> Connect Slack</a>}</section>
        <footer className="page-footer">ReachInbox Scheduler <span>·</span> TypeScript <span>·</span> BullMQ + Redis <span>·</span> Ethereal test mode</footer>
      </div>
    </main>
    {compose && <ComposeModal senders={senders} onClose={() => setCompose(false)} onScheduled={(count) => { setCompose(false); setTab('scheduled'); flash(`${count} ${count === 1 ? 'email was' : 'emails were'} added to the schedule.`); loadEmails('scheduled', query); }} />}
    {toast && <div className="toast"><span className="toast-check"><Icon name="check" /></span>{toast}</div>}
  </div>;
}

function Avatar({ user }: { user: User }) {
  return user.avatar ? <img className="avatar" src={user.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar avatar-fallback">{initials(user.name)}</span>;
}

function Login() {
  return <main className="login-page"><div className="login-gradient" /><div className="login-card"><a className="brand login-brand" href="#"><span className="brand-symbol">R</span><span>reachinbox<span className="brand-dot">.</span></span></a><div className="eyebrow">SCHEDULING, MADE RELIABLE</div><h1>Emails that arrive right on time.</h1><p>Sign in to plan outreach, follow your delivery queue, and keep every send on schedule.</p><a className="google-button" href="/auth/google"><GoogleMark /> Continue with Google</a><div className="login-foot"><span className="secure-dot" /> Secure sign-in with Google OAuth</div><div className="login-art"><div className="art-email"><span /><span /><span /></div><div className="art-clock"><Icon name="clock" /></div><div className="art-check"><Icon name="check" /></div></div></div><div className="login-caption">REACHINBOX <span>·</span> OUTBOX LABS</div></main>;
}

function GoogleMark() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.7 5.98c4.5-4.15 7.1-10.28 7.1-17.63Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.28-3.13.78-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.86.93 7.51 2.55 10.78l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.82l-7.7-5.98c-2.14 1.44-4.88 2.3-8.2 2.3-6.27 0-11.58-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>; }

function Metric({ icon, label, value, color, helper }: { icon: string; label: string; value: string | number; color: string; helper: string }) {
  return <article className="metric-card"><div className="metric-top"><span className={`metric-icon ${color}`}><Icon name={icon} /></span><span>{label}</span></div><strong className={`metric-value ${typeof value === 'string' ? 'small-value' : ''}`}>{value}</strong><span className="metric-helper">{helper}</span></article>;
}

function EmailTable({ items, loading, state, onCancel }: { items: Email[]; loading: boolean; state: string; onCancel: (id: string) => void }) {
  if (loading) return <div className="table-loading"><span className="spinner" /> Loading {state} emails…</div>;
  if (!items.length) return <div className="empty-state"><div className="empty-envelope"><Icon name="mail" /></div><strong>{state === 'scheduled' ? 'Nothing on the schedule yet' : state === 'sent' ? 'No emails sent yet' : 'No failed emails'}</strong><p>{state === 'scheduled' ? 'Compose an email and choose when it should arrive.' : state === 'sent' ? 'Messages captured by Ethereal will appear here.' : 'Your email delivery is looking good.'}</p></div>;
  return <div className="table-scroll"><table className="email-table"><thead><tr><th>RECIPIENT</th><th>SUBJECT</th><th>STATUS</th><th>{state === 'sent' ? 'SENT AT' : 'SCHEDULED FOR'}</th><th>SENDER</th><th /></tr></thead><tbody>{items.map((email) => <tr key={email.id}>
    <td><div className="recipient-cell"><span className="recipient-avatar">{initials(email.recipient)}</span><span>{email.recipient}</span></div></td><td className="subject-cell" title={email.subject}>{email.subject}</td>
    <td><span className={`status-badge ${email.status}`}><i />{email.status === 'scheduled' ? 'Scheduled' : email.status === 'sending' ? 'Sending' : email.status === 'sent' ? 'Sent' : email.status === 'failed' ? 'Failed' : 'Cancelled'}</span></td>
    <td><div className="time-main">{timeLabel(email.sentAt || email.scheduledAt)}</div><div className="time-sub">{dateLabel(email.sentAt || email.scheduledAt)}</div></td>
    <td><span className="sender-chip">{email.senderName || 'Ethereal'}</span></td>
    <td className="table-actions">{email.status === 'scheduled' ? <button className="row-cancel" onClick={() => onCancel(email.id)}>Cancel</button> : email.status === 'sent' && email.previewUrl ? <a className="preview-link" href={email.previewUrl} target="_blank" rel="noreferrer">Preview ↗</a> : email.status === 'failed' && email.error ? <span className="error-info" title={email.error}>Details</span> : null}</td>
  </tr>)}</tbody></table></div>;
}

function ComposeModal({ senders, onClose, onScheduled }: { senders: Sender[]; onClose: () => void; onScheduled: (count: number) => void }) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [form, setForm] = useState({ subject: '', body: '', senderId: senders[0]?.id || '', startAt: '', delaySeconds: '2', hourlyLimit: String(senders[0]?.maxPerHour ?? 200) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const filePicked = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    Papa.parse<string[]>(file, { skipEmptyLines: true, complete: ({ data }) => {
      const text = data.flat().join(' ');
      const detected = [...text.matchAll(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g)].map((match) => match[0].toLowerCase());
      const unique = [...new Set(detected)];
      setRecipients(unique);
      setErrors((current) => ({ ...current, recipients: unique.length ? '' : 'No email addresses were detected in this file.' }));
    }, error: (error) => setErrors((current) => ({ ...current, recipients: error.message })) });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setErrors({}); setProblem('');
    const next: Record<string, string> = {};
    if (!recipients.length) next.recipients = 'Upload a CSV or text file with at least one email address.';
    if (!form.subject.trim()) next.subject = 'Add an email subject.';
    if (!form.body.trim()) next.body = 'Write the email message.';
    if (!form.senderId) next.senderId = 'Choose a sender.';
    if (!form.startAt || new Date(form.startAt).getTime() < Date.now() + 30000) next.startAt = 'Choose a start time at least 30 seconds from now.';
    if (Object.keys(next).length) { setErrors(next); return; }
    setSubmitting(true);
    try {
      const result = await api<{ count: number }>('/api/emails', { method: 'POST', body: JSON.stringify({ idempotencyKey, recipients, subject: form.subject, body: form.body,
        senderId: form.senderId, startAt: new Date(form.startAt).toISOString(), delaySeconds: Number(form.delaySeconds), hourlyLimit: Number(form.hourlyLimit) }) });
      onScheduled(result.count);
    } catch (error) { const apiError = error as ApiError; setErrors(apiError.fields || {}); setProblem(apiError.fields ? '' : apiError.message); }
    finally { setSubmitting(false); }
  };

  const selectedSender = senders.find((sender) => sender.id === form.senderId);
  const minStartAt = new Date(Date.now() + 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="compose-modal" role="dialog" aria-modal="true" aria-labelledby="compose-title">
    <div className="modal-header"><div><div className="eyebrow">NEW CAMPAIGN</div><h2 id="compose-title">Compose new email</h2><p>Choose your recipients, then set the delivery pace.</p></div><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
    <form onSubmit={submit}>
      <label className="field-label">Recipients <span>CSV or text file</span></label>
      <label className="upload-zone"><input type="file" accept=".csv,.txt,text/plain,text/csv" onChange={(event) => filePicked(event.target.files?.[0])} /><span className="upload-symbol"><Icon name="upload" /></span><strong>{fileName || 'Choose a recipient file'}</strong><small>{recipients.length ? `${recipients.length.toLocaleString()} email addresses detected` : 'CSV or TXT · up to 5,000 unique emails'}</small></label>
      {errors.recipients && <span className="field-error">{errors.recipients}</span>}
      <label className="field-label" htmlFor="subject">Subject</label><input id="subject" maxLength={200} value={form.subject} onChange={(event) => set('subject', event.target.value)} placeholder="A subject they’ll want to open" />{errors.subject && <span className="field-error">{errors.subject}</span>}
      <div className="field-grid pace-grid"><div><label className="field-label" htmlFor="delay">Delay between emails <span>seconds</span></label><input id="delay" type="number" min={selectedSender?.minDelaySeconds ?? 0} max="3600" value={form.delaySeconds} onChange={(event) => set('delaySeconds', event.target.value)} /></div><div><label className="field-label" htmlFor="hourly">Hourly limit</label><input id="hourly" type="number" min="1" max={selectedSender?.maxPerHour ?? 200} value={form.hourlyLimit} onChange={(event) => set('hourlyLimit', event.target.value)} />{errors.hourlyLimit && <span className="field-error">{errors.hourlyLimit}</span>}</div></div>
      <label className="field-label" htmlFor="body">Message</label><textarea id="body" rows={5} maxLength={10000} value={form.body} onChange={(event) => set('body', event.target.value)} placeholder="Type your reply…" />{errors.body && <span className="field-error">{errors.body}</span>}
      <div className="field-grid"><div><label className="field-label" htmlFor="sender">From sender</label><select id="sender" value={form.senderId} onChange={(event) => { set('senderId', event.target.value); const sender = senders.find((entry) => entry.id === event.target.value); if (sender) set('hourlyLimit', String(sender.maxPerHour)); }}>{senders.map((sender) => <option key={sender.id} value={sender.id}>{sender.name}</option>)}</select>{errors.senderId && <span className="field-error">{errors.senderId}</span>}</div><div><label className="field-label" htmlFor="startAt">Start time</label><input id="startAt" type="datetime-local" min={minStartAt} value={form.startAt} onChange={(event) => set('startAt', event.target.value)} />{errors.startAt && <span className="field-error">{errors.startAt}</span>}</div></div>
      <div className="sandbox-note"><span>i</span><p><strong>Test mode:</strong> Ethereal captures messages for preview. Nothing is delivered to real inboxes.</p></div>
      {problem && <p className="form-problem">{problem}</p>}
      <div className="modal-actions"><button className="quiet-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={submitting || !senders.length}><Icon name="clock" /> {submitting ? 'Scheduling…' : `Schedule ${recipients.length || ''} email${recipients.length === 1 ? '' : 's'}`}</button></div>
    </form>
  </section></div>;
}
