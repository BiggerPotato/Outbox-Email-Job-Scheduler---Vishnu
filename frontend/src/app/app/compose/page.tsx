'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { composeSchema, type ComposeFormValues } from '@/lib/validations/compose-schema';
import { getCurrentUser } from '@/lib/api/auth';
import { listSenders, createSender } from '@/lib/api/senders';
import { validateCsvFile } from '@/lib/api/csv';
import { parseCsvText } from '@/lib/utils/csv-parser';
import { isValidEmail } from '@/lib/utils/validate-email';
import { getApiErrorMessage } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils/cn';
import { clearComposeDraft, getComposeDraft, saveComposeDraft } from '@/lib/utils/compose-draft';
import { useCampaigns } from '@/lib/hooks/use-campaigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { CalendarClock, Loader2, Mail, MailCheck, Upload, X } from 'lucide-react';

const pad = (value: number) => String(value).padStart(2, '0');
const toLocalTimeValue = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

function parseEmails(text: string) {
  const raw = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const value of raw) {
    const normalized = value.toLowerCase();
    if (!isValidEmail(value)) {
      invalid.push(value);
      continue;
    }
    if (seen.has(normalized)) {
      duplicates += 1;
      continue;
    }
    seen.add(normalized);
    valid.push(value);
  }

  return { valid, invalid, duplicates, total: raw.length };
}

/** Render the ComposePage component. */
export default function ComposePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { createCampaign } = useCampaigns();
  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
    retry: 1
  });
  const { data: senders = [], isError: sendersError } = useQuery({
    queryKey: ['senders'],
    queryFn: listSenders
  });

  const senderForm = useForm<{ displayName: string; email: string }>({
    defaultValues: { displayName: '', email: '' },
    mode: 'onChange'
  });

  const addSenderMutation = useMutation({
    mutationFn: (values: { displayName: string; email: string }) =>
      createSender({ name: values.displayName, email: values.email }),
    onSuccess: (sender) => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      setValue('senderId', sender.id, { shouldValidate: true });
      senderForm.reset();
      setSenderDialogOpen(false);
      toast.success('Sender added.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Unable to add sender.'));
    }
  });

  useEffect(() => {
    if (sendersError) {
      toast.error('Unable to load senders.');
    }
  }, [sendersError]);

  const [recipientMode, setRecipientMode] = useState<'paste' | 'csv'>('paste');
  const [pasteValue, setPasteValue] = useState('');
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvDragging, setCsvDragging] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [stats, setStats] = useState({ total: 0, invalid: 0, duplicates: 0 });
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState('');
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isValid }
  } = useForm<ComposeFormValues>({
    resolver: zodResolver(composeSchema),
    mode: 'onChange',
    defaultValues: {
      senderId: '',
      recipients: [],
      subject: '',
      body: '',
      scheduledAt: new Date(),
      scheduledTime: toLocalTimeValue(new Date()),
      delayBetweenEmails: 2,
      hourlyLimit: 200
    }
  });

  const senderId = watch('senderId');
  const subject = watch('subject');
  const body = watch('body');
  const recipients = watch('recipients');
  const scheduledAt = watch('scheduledAt');
  const scheduledTime = watch('scheduledTime');
  const delayBetweenEmails = watch('delayBetweenEmails');
  const hourlyLimit = watch('hourlyLimit');

  useEffect(() => {
    if (!senderId && senders.length) {
      setValue('senderId', senders[0].id, { shouldValidate: true });
    }
  }, [senderId, senders, setValue]);

  useEffect(() => {
    const draft = getComposeDraft();
    if (!draft) return;

    if (draft.senderId) {
      setValue('senderId', draft.senderId, { shouldValidate: true });
    }
    if (draft.recipients?.length) {
      setValue('recipients', draft.recipients, { shouldValidate: true });
      setPasteValue(draft.recipients.join('\n'));
      setStats({ total: draft.recipients.length, invalid: 0, duplicates: 0 });
    }
    if (draft.subject) {
      setValue('subject', draft.subject, { shouldValidate: true });
    }
    if (draft.body) {
      setValue('body', draft.body, { shouldValidate: true });
    }
    if (typeof draft.delayBetweenEmails === 'number') {
      const normalizedDelay =
        draft.delayBetweenEmails > 300 ? Math.round(draft.delayBetweenEmails / 1000) : draft.delayBetweenEmails;
      setValue('delayBetweenEmails', normalizedDelay, { shouldValidate: true });
    }
    if (typeof draft.hourlyLimit === 'number') {
      setValue('hourlyLimit', draft.hourlyLimit, { shouldValidate: true });
    }
    if (draft.scheduledDate) {
      const parsed = new Date(draft.scheduledDate);
      if (!Number.isNaN(parsed.getTime())) {
        setValue('scheduledAt', parsed, { shouldValidate: true });
      }
    }
    if (draft.scheduledTime) {
      setValue('scheduledTime', draft.scheduledTime, { shouldValidate: true });
    }
    setDraftRestored(true);
  }, [setValue]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const values = getValues();
      saveComposeDraft({
        senderId: values.senderId,
        recipients: values.recipients,
        subject: values.subject,
        body: values.body,
        delayBetweenEmails: values.delayBetweenEmails,
        hourlyLimit: values.hourlyLimit,
        scheduledDate: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : '',
        scheduledTime: values.scheduledTime
      });
      setDraftSavedAt(new Date());
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [senderId, recipients, subject, body, scheduledAt, scheduledTime, delayBetweenEmails, hourlyLimit, getValues]);

  const snippetOptions = useMemo(
    () => [
      {
        id: 'intro',
        label: 'Intro + context',
        content: 'Hi {{first_name}},\n\nI hope you are doing well. I wanted to share a quick update on...'
      },
      {
        id: 'follow-up',
        label: 'Follow-up',
        content: 'Just following up on my previous note. Happy to answer any questions or share more details.'
      },
      {
        id: 'cta',
        label: 'Call-to-action',
        content: 'Would you like me to send a short overview or set up a quick 10-minute call?'
      },
      {
        id: 'signature',
        label: 'Signature',
        content: 'Best regards,\n{{your_name}}\n{{your_title}}\n{{company}}'
      }
    ],
    []
  );

  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const scheduleSummary = useMemo(() => {
    if (!scheduledAt || !scheduledTime) return 'Select a start date and time.';
    return `${format(scheduledAt, 'PPP')} at ${scheduledTime} (${timeZone})`;
  }, [scheduledAt, scheduledTime, timeZone]);

  const updateRecipients = (next: string[], statsValue: { total: number; invalid: number; duplicates: number }) => {
    setValue('recipients', next, { shouldValidate: true });
    setStats(statsValue);
  };

  const handlePasteApply = () => {
    const result = parseEmails(pasteValue);
    setInvalidEmails(result.invalid);
    updateRecipients(result.valid, {
      total: result.total,
      invalid: result.invalid.length,
      duplicates: result.duplicates
    });
  };

  const handleCsvUpload = async (file: File) => {
    setCsvFileName(file.name);
    setCsvParsing(true);
    try {
      const result = await validateCsvFile(file);
      setInvalidEmails(result.invalid);
      updateRecipients(result.valid, {
        total: result.total ?? result.valid.length + result.invalid.length + result.duplicates,
        invalid: result.invalid.length,
        duplicates: result.duplicates
      });
    } catch {
      const text = await file.text();
      const result = parseCsvText(text);
      setInvalidEmails(result.invalid);
      updateRecipients(result.valid, {
        total: result.valid.length + result.invalid.length + result.duplicates,
        invalid: result.invalid.length,
        duplicates: result.duplicates
      });
    } finally {
      setCsvParsing(false);
    }
  };

  const removeRecipient = (email: string) => {
    const next = recipients.filter((recipient) => recipient !== email);
    setValue('recipients', next, { shouldValidate: true });
    setPasteValue(next.join('\n'));
  };

  const removeInvalids = () => {
    if (!invalidEmails.length) return;
    const invalidSet = new Set(invalidEmails.map((email) => email.toLowerCase()));
    const next = recipients.filter((recipient) => !invalidSet.has(recipient.toLowerCase()));
    setValue('recipients', next, { shouldValidate: true });
    setPasteValue(next.join('\n'));
    setInvalidEmails([]);
    setStats((prev) => ({ ...prev, invalid: 0, total: next.length }));
  };

  const handleInsertSnippet = () => {
    const snippet = snippetOptions.find((item) => item.id === selectedSnippet);
    if (!snippet) return;
    const nextBody = body ? `${body}\n\n${snippet.content}` : snippet.content;
    setValue('body', nextBody, { shouldValidate: true });
    setSelectedSnippet('');
  };

  const handleSendTest = async () => {
    const values = getValues();
    if (!currentUser?.email) {
      toast.error('Add a profile email to send a test.');
      return;
    }
    if (!values.senderId) {
      toast.error('Select a sender first.');
      return;
    }
    if (!values.subject || !values.body) {
      toast.error('Add a subject and body to send a test.');
      return;
    }
    setTestSending(true);
    try {
      await createCampaign.mutateAsync({
        senderId: values.senderId,
        subject: values.subject,
        body: values.body,
        recipients: [currentUser.email],
        scheduledStartAt: new Date().toISOString(),
        delayBetweenEmails: values.delayBetweenEmails * 1000,
        hourlyLimit: values.hourlyLimit
      });
      toast.success('Test email scheduled to your inbox.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to send test email.'));
    } finally {
      setTestSending(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const [hours, minutes] = values.scheduledTime.split(':').map(Number);
    const scheduled = new Date(values.scheduledAt);
    scheduled.setHours(hours || 0, minutes || 0, 0, 0);

    try {
      await createCampaign.mutateAsync({
        senderId: values.senderId,
        subject: values.subject,
        body: values.body,
        recipients: values.recipients,
        scheduledStartAt: scheduled.toISOString(),
        delayBetweenEmails: values.delayBetweenEmails * 1000,
        hourlyLimit: values.hourlyLimit
      });
      clearComposeDraft();
      toast.success('Campaign scheduled.');
      router.push('/app/scheduled');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to schedule campaign.'));
    }
  });

  const previewBody = useMemo(() => body || 'No content yet.', [body]);
  const previewSubject = useMemo(() => subject || 'No subject yet.', [subject]);
  const subjectCount = subject.length;
  const bodyCount = body.length;
  const subjectOverLimit = subjectCount > 78;
  const bodyTooShort = bodyCount > 0 && bodyCount < 50;
  const recipientPreview = useMemo(() => {
    if (showAllRecipients) return recipients;
    return recipients.slice(0, 10);
  }, [recipients, showAllRecipients]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compose</p>
          <h1 className="heading-font text-2xl font-semibold">New Campaign</h1>
          <p className="text-sm text-muted-foreground">Draft your message and schedule delivery.</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {draftRestored && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Mail className="h-4 w-4 text-primary" />
              Draft restored from your last session.
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-3"
                onClick={() => {
                  clearComposeDraft();
                  setDraftRestored(false);
                }}
              >
                Discard
              </Button>
            </div>
          )}
          {draftSavedAt && (
            <p className="text-xs text-muted-foreground">
              Autosaved {format(draftSavedAt, 'p')}
            </p>
          )}
        </div>

        <form className="mt-6 space-y-6" onSubmit={onSubmit}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold">Sender</h2>
                    <p className="text-xs text-muted-foreground">Choose the account that will send this campaign.</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary underline underline-offset-4"
                    onClick={() => setSenderDialogOpen(true)}
                  >
                    Add sender
                  </button>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="senderId"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Sender
                  </label>
                  <select
                    id="senderId"
                    className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    {...register('senderId')}
                    value={senderId}
                    onChange={(event) => setValue('senderId', event.target.value, { shouldValidate: true })}
                    disabled={!senders.length}
                  >
                    <option value="" disabled>
                      Select sender
                    </option>
                    {senders.map((sender) => (
                      <option key={sender.id} value={sender.id}>
                        {sender.name} ({sender.email})
                      </option>
                    ))}
                  </select>
                  {errors.senderId && <p className="text-xs text-rose-500">{errors.senderId.message}</p>}
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold">Recipients</h2>
                  <p className="text-xs text-muted-foreground">Add one email per line or upload a CSV file.</p>
                </div>
                <input type="hidden" {...register('recipients')} />
                <Tabs value={recipientMode} onValueChange={(value) => setRecipientMode(value as 'paste' | 'csv')}>
                  <TabsList>
                    <TabsTrigger value="paste">Paste emails</TabsTrigger>
                    <TabsTrigger value="csv">Upload CSV</TabsTrigger>
                  </TabsList>
                  <TabsContent value="paste" className="space-y-3">
                    <label
                      htmlFor="paste-emails"
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Paste list
                    </label>
                    <Textarea
                      id="paste-emails"
                      className="min-h-[140px]"
                      placeholder="name@example.com"
                      value={pasteValue}
                      onChange={(event) => setPasteValue(event.target.value)}
                      onBlur={handlePasteApply}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">One email per line.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="transition-transform hover:-translate-y-0.5"
                        onClick={handlePasteApply}
                      >
                        Apply emails
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="csv" className="space-y-3">
                    <label
                      htmlFor="csv-upload"
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      CSV file
                    </label>
                    <input
                      ref={csvInputRef}
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      disabled={csvParsing}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleCsvUpload(file);
                        }
                      }}
                    />
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        setCsvDragging(true);
                      }}
                      onDragLeave={() => setCsvDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setCsvDragging(false);
                        const file = event.dataTransfer.files?.[0];
                        if (file) {
                          void handleCsvUpload(file);
                        }
                      }}
                      className={cn(
                        'flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-white text-center transition-all',
                        csvDragging && 'border-[#7b1b5a] bg-[#f7e9f1]'
                      )}
                    >
                      <Upload className="h-8 w-8 text-muted-foreground/70" />
                      <p className="text-sm font-medium text-foreground">Drag & drop CSV</p>
                      <p className="text-xs text-muted-foreground">
                        or{' '}
                        <button
                          type="button"
                          onClick={() => csvInputRef.current?.click()}
                          className="font-semibold text-[#7b1b5a] hover:underline"
                        >
                          browse
                        </button>
                      </p>
                    </div>
                    {csvParsing && <p className="text-xs text-muted-foreground">Parsing recipients…</p>}
                    {!csvParsing && csvFileName && <p className="text-xs text-muted-foreground">Loaded: {csvFileName}</p>}
                  </TabsContent>
                </Tabs>
                {errors.recipients && <p className="text-xs text-rose-500">{errors.recipients.message}</p>}
                <div className="text-xs text-muted-foreground">
                  Total: {stats.total} | Invalid: {stats.invalid} | Duplicates removed: {stats.duplicates}
                </div>
                <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-muted-foreground">
                      Showing {recipientPreview.length} of {recipients.length} recipients
                    </p>
                    {recipients.length > 10 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowAllRecipients((current) => !current)}
                      >
                        {showAllRecipients ? 'Show less' : 'Show all'}
                      </Button>
                    )}
                  </div>
                  {recipientPreview.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recipients added yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {recipientPreview.map((email) => (
                        <span
                          key={email}
                          className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-muted-foreground shadow-sm"
                        >
                          {email}
                          <button
                            type="button"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => removeRecipient(email)}
                            aria-label={`Remove ${email}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {invalidEmails.length > 0 && (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground">Invalid addresses detected:</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={removeInvalids}
                        >
                          Remove invalids
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {invalidEmails.slice(0, 8).map((email) => (
                          <span
                            key={email}
                            className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-600"
                          >
                            {email}
                          </span>
                        ))}
                        {invalidEmails.length > 8 && (
                          <span className="text-xs text-muted-foreground">
                            +{invalidEmails.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold">Content</h2>
                  <p className="text-xs text-muted-foreground">Write the email subject and body.</p>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="subject"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Subject
                  </label>
                  <Input id="subject" placeholder="Subject line" {...register('subject')} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{subjectCount} characters</span>
                    {subjectOverLimit && <span className="text-amber-600">Recommended under 78 characters.</span>}
                  </div>
                  {errors.subject && <p className="text-xs text-rose-500">{errors.subject.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Snippets
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-10 flex-1 rounded-2xl border border-border bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedSnippet}
                      onChange={(event) => setSelectedSnippet(event.target.value)}
                    >
                      <option value="">Select a snippet</option>
                      {snippetOptions.map((snippet) => (
                        <option key={snippet.id} value={snippet.id}>
                          {snippet.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="transition-transform hover:-translate-y-0.5"
                      onClick={handleInsertSnippet}
                      disabled={!selectedSnippet}
                    >
                      Insert
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <label
                      htmlFor="body"
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Body
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="transition-transform hover:-translate-y-0.5"
                      onClick={() => setPreviewOpen(true)}
                    >
                      Preview
                    </Button>
                  </div>
                  <Textarea
                    id="body"
                    className="min-h-[200px]"
                    placeholder="Write your email body here..."
                    {...register('body')}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{bodyCount} characters</span>
                    {bodyTooShort && <span className="text-amber-600">Short body — add more context.</span>}
                  </div>
                  {errors.body && <p className="text-xs text-rose-500">{errors.body.message}</p>}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  <h2 className="text-sm font-semibold">Schedule</h2>
                  <p className="text-xs text-muted-foreground">Pick a date and time to start sending.</p>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="scheduledAt"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Start date
                  </label>
                  <input type="hidden" {...register('scheduledAt', { valueAsDate: true })} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between">
                        {watch('scheduledAt') ? format(watch('scheduledAt'), 'PPP') : 'Pick a date'}
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start">
                      <Calendar
                        mode="single"
                        selected={watch('scheduledAt')}
                        onSelect={(date) => date && setValue('scheduledAt', date, { shouldValidate: true })}
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.scheduledAt && <p className="text-xs text-rose-500">{errors.scheduledAt.message}</p>}
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="scheduledTime"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Start time
                  </label>
                  <Input id="scheduledTime" type="time" {...register('scheduledTime')} />
                  {errors.scheduledTime && <p className="text-xs text-rose-500">{errors.scheduledTime.message}</p>}
                </div>
                <div className="rounded-2xl border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
                  {scheduleSummary}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                  <label
                    htmlFor="delayBetweenEmails"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Delay (seconds)
                  </label>
                  <Input id="delayBetweenEmails" type="number" min={0} {...register('delayBetweenEmails')} />
                  {errors.delayBetweenEmails && (
                      <p className="text-xs text-rose-500">{errors.delayBetweenEmails.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="hourlyLimit"
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Hourly limit
                    </label>
                    <Input id="hourlyLimit" type="number" min={1} {...register('hourlyLimit')} />
                    {errors.hourlyLimit && <p className="text-xs text-rose-500">{errors.hourlyLimit.message}</p>}
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 transition-shadow duration-200 hover:shadow-md">
                <div className="text-sm text-muted-foreground">{recipients.length} recipients ready to schedule.</div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full transition-transform hover:-translate-y-0.5"
                  onClick={handleSendTest}
                  disabled={testSending || !subject || !body || !senderId}
                >
                  {testSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending test…
                    </>
                  ) : (
                    <>
                      <MailCheck className="h-4 w-4" />
                      Send test to me
                    </>
                  )}
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid || createCampaign.isPending}
                  title={!isValid ? 'Complete the required fields to schedule.' : undefined}
                  className="w-full bg-primary text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  {createCampaign.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    'Schedule Campaign'
                  )}
                </Button>
              </section>
            </aside>
          </div>
        </form>
      </div>

      <Dialog open={senderDialogOpen} onOpenChange={setSenderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add sender</DialogTitle>
            <DialogDescription>Provide a display name and sender email.</DialogDescription>
          </DialogHeader>
          <form
            className="mt-4 space-y-4"
            onSubmit={senderForm.handleSubmit((values) => addSenderMutation.mutate(values))}
          >
            <div className="space-y-2">
              <label htmlFor="sender-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Display name
              </label>
              <Input id="sender-name" {...senderForm.register('displayName', { required: true })} />
            </div>
            <div className="space-y-2">
              <label htmlFor="sender-email" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Email
              </label>
              <Input id="sender-email" type="email" {...senderForm.register('email', { required: true })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSenderDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addSenderMutation.isPending}>
                {addSenderMutation.isPending ? 'Adding...' : 'Add sender'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>This is how the message will appear to recipients.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subject</p>
              <p className="font-medium">{previewSubject}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Body</p>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 whitespace-pre-wrap">
                {previewBody}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
