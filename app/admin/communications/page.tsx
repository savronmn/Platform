"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Mail, Send, Users, CheckCircle2, AlertCircle, Search, History, RefreshCw, ChevronDown, Wallet, Clock, CalendarClock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Recipient = { email: string; name?: string };

type EmailHistoryItem = {
    id: string;
    to: string[];
    from: string;
    subject: string | null;
    created_at: string;
    last_event: string | null;
};

function formatHistoryDate(value: string): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function eventBadgeClass(event: string | null): string {
    switch (event) {
        case 'delivered':
            return 'bg-savron-green/15 text-accent-blue border-savron-green/25';
        case 'opened':
        case 'clicked':
            return 'bg-blue-500/15 text-blue-300 border-blue-500/25';
        case 'bounced':
        case 'complained':
            return 'bg-red-500/15 text-red-300 border-red-500/25';
        case 'delivery_delayed':
            return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
        default:
            return 'bg-white/5 text-savron-silver border-white/10';
    }
}

export default function CommunicationsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [targetGroup, setTargetGroup] = useState<'all' | 'clients' | 'subscribers'>('all');
    const [includeMembershipPass, setIncludeMembershipPass] = useState(false);
    const [sendTiming, setSendTiming] = useState<'now' | 'scheduled'>('now');
    const [scheduledAt, setScheduledAt] = useState('');
    
    const [clients, setClients] = useState<Recipient[]>([]);
    const [subscribers, setSubscribers] = useState<Recipient[]>([]);
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [recipientSearch, setRecipientSearch] = useState('');
    const [history, setHistory] = useState<EmailHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [historyHasMore, setHistoryHasMore] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const [clientsRes, subsRes] = await Promise.all([
                supabase.from('clients').select('name, email'),
                supabase.from('email_subscribers').select('name, email')
            ]);
            
            if (clientsRes.data) {
                setClients(clientsRes.data.filter(c => c.email).map(c => ({ name: c.name, email: c.email! })));
            }
            if (subsRes.data) {
                setSubscribers(subsRes.data.filter(s => s.email).map(s => ({ name: s.name, email: s.email! })));
            }
            setLoading(false);
        }
        fetchData();
        void fetchHistory();
    }, []);

    async function fetchHistory(options: { after?: string; append?: boolean } = {}) {
        if (options.append) setHistoryLoadingMore(true);
        else setHistoryLoading(true);
        setHistoryError('');

        try {
            const params = new URLSearchParams({ limit: '25' });
            if (options.after) params.set('after', options.after);

            const res = await fetch(`/api/email/history?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to load email history');
            }

            const emails = (data.emails ?? []) as EmailHistoryItem[];
            setHistory(prev => options.append ? [...prev, ...emails] : emails);
            setHistoryHasMore(Boolean(data.hasMore));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load email history';
            setHistoryError(message);
            if (!options.append) setHistory([]);
            setHistoryHasMore(false);
        } finally {
            setHistoryLoading(false);
            setHistoryLoadingMore(false);
        }
    }

    const activeRecipients = useMemo(() => {
        let pool: Recipient[] = [];
        if (targetGroup === 'clients' || targetGroup === 'all') pool = [...pool, ...clients];
        if (targetGroup === 'subscribers' || targetGroup === 'all') pool = [...pool, ...subscribers];

        const unique = new Map<string, Recipient>();
        for (const recipient of pool) {
            unique.set(recipient.email.toLowerCase(), recipient);
        }
        return Array.from(unique.values());
    }, [targetGroup, clients, subscribers]);

    useEffect(() => {
        setSelectedEmails(new Set(activeRecipients.map(r => r.email.toLowerCase())));
        setRecipientSearch('');
    }, [activeRecipients]);

    const filteredRecipients = useMemo(() => {
        if (!recipientSearch.trim()) return activeRecipients;
        const query = recipientSearch.toLowerCase();
        return activeRecipients.filter(r =>
            r.email.toLowerCase().includes(query) ||
            r.name?.toLowerCase().includes(query),
        );
    }, [activeRecipients, recipientSearch]);

    const selectedRecipients = useMemo(
        () => activeRecipients.filter(r => selectedEmails.has(r.email.toLowerCase())),
        [activeRecipients, selectedEmails],
    );

    const allFilteredSelected = filteredRecipients.length > 0
        && filteredRecipients.every(r => selectedEmails.has(r.email.toLowerCase()));

    function toggleRecipient(email: string) {
        const key = email.toLowerCase();
        setSelectedEmails(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function toggleAllFiltered() {
        setSelectedEmails(prev => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filteredRecipients.forEach(r => next.delete(r.email.toLowerCase()));
            } else {
                filteredRecipients.forEach(r => next.add(r.email.toLowerCase()));
            }
            return next;
        });
    }

    const subscriberEmailSet = useMemo(
        () => new Set(subscribers.map(s => s.email.toLowerCase())),
        [subscribers],
    );

    const passEligibleRecipients = useMemo(
        () => selectedRecipients.filter(r => subscriberEmailSet.has(r.email.toLowerCase())),
        [selectedRecipients, subscriberEmailSet],
    );

    const defaultPassSubject = 'SAVRON — Your Membership Pass';
    const [successDetail, setSuccessDetail] = useState<string | null>(null);

    const sendCount = includeMembershipPass ? passEligibleRecipients.length : selectedRecipients.length;

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();

        if (includeMembershipPass) {
            if (passEligibleRecipients.length === 0) {
                setErrorMsg('Select at least one ePass subscriber. CRM-only clients cannot receive wallet passes.');
                setStatus('error');
                return;
            }
            if (sendTiming === 'scheduled' && !scheduledAt) {
                setErrorMsg('Choose a date and time for the scheduled send.');
                setStatus('error');
                return;
            }
        } else if (selectedRecipients.length === 0) {
            setErrorMsg('Select at least one recipient.');
            setStatus('error');
            return;
        }

        if (!includeMembershipPass && !content.trim()) {
            setErrorMsg('Email content is required.');
            setStatus('error');
            return;
        }

        setSending(true);
        setStatus('idle');
        setErrorMsg('');
        setSuccessDetail(null);

        try {
            if (includeMembershipPass) {
                const payload: Record<string, unknown> = {
                    subscriberEmails: passEligibleRecipients.map(r => r.email),
                    subject: subject.trim() || defaultPassSubject,
                    message: content.trim(),
                };
                if (sendTiming === 'scheduled') {
                    payload.sendAt = new Date(scheduledAt).toISOString();
                }

                const res = await fetch('/api/wallet/send-passes-bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();

                if (res.ok) {
                    setStatus('success');
                    setSuccessDetail(data.message || 'Membership pass send completed.');
                    if (!data.scheduled) {
                        setSubject('');
                        setContent('');
                        setScheduledAt('');
                        void fetchHistory();
                    }
                } else {
                    setStatus('error');
                    setErrorMsg(data.error || 'Failed to send membership passes');
                }
                return;
            }

            const htmlContent = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <div style="text-align: center; padding: 20px 0;">
                        <img src="https://savronmn.com/logo.png" alt="SAVRON" style="max-height: 40px; background-color: #000; padding: 10px;" />
                    </div>
                    <div style="padding: 20px; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">
                        ${content}
                    </div>
                    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; margin-top: 30px; font-size: 12px; color: #999;">
                        SAVRON Barbershop & Lounge &copy; ${new Date().getFullYear()}
                    </div>
                </div>
            `;

            const res = await fetch('/api/email/brevo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    htmlContent,
                    recipients: selectedRecipients,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStatus('success');
                const failedNote = data.failed ? ` (${data.failed} failed)` : '';
                setSuccessDetail(`Campaign sent to ${data.sent} recipient${data.sent !== 1 ? 's' : ''}${failedNote}.`);
                setSubject('');
                setContent('');
                void fetchHistory();
            } else {
                setStatus('error');
                setErrorMsg(data.error || 'Failed to send campaign');
            }
        } catch {
            setStatus('error');
            setErrorMsg('Network error. Please try again later.');
        } finally {
            setSending(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div>
                    <p className="admin-kicker">Campaigns</p>
                    <h1 className="admin-title">Communications</h1>
                    <p className="admin-subtitle">
                        Send mass emails to clients and subscribers, or bulk-send ePass membership passes with Apple/Google Wallet download links.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-savron">
                        <Users size={14} className="text-savron-silver" />
                        <span className="text-[10px] uppercase tracking-widest text-white">
                            {sendCount} Selected{includeMembershipPass ? ' (ePass)' : ''}
                        </span>
                    </div>
                    {includeMembershipPass && selectedRecipients.length > passEligibleRecipients.length && (
                        <span className="text-[10px] uppercase tracking-widest text-amber-300/80 px-3 py-2 border border-amber-500/20 rounded-savron bg-amber-500/5">
                            {selectedRecipients.length - passEligibleRecipients.length} CRM-only skipped
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 card-savron">
                    <form onSubmit={handleSend} className="space-y-6">
                        <AnimatePresence>
                            {status === 'success' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    className="bg-savron-blue/10 border border-savron-blue/20 text-accent-blue p-4 rounded-savron flex items-center gap-3"
                                >
                                    <CheckCircle2 size={16} />
                                    <span className="text-xs uppercase tracking-widest">
                                        {successDetail || (includeMembershipPass ? 'Membership pass send completed!' : 'Campaign sent successfully!')}
                                    </span>
                                </motion.div>
                            )}
                            {status === 'error' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-savron flex items-center gap-3"
                                >
                                    <AlertCircle size={16} />
                                    <span className="text-xs uppercase tracking-widest">{errorMsg}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">Target Audience</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                    { id: 'all', label: 'Everyone' },
                                    { id: 'clients', label: 'CRM Clients' },
                                    { id: 'subscribers', label: 'E-Pass Subscribers' },
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setTargetGroup(t.id as any)}
                                        className={`py-3 px-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all ${
                                            targetGroup === t.id 
                                            ? 'bg-savron-green text-white border border-savron-green-light/20' 
                                            : 'text-savron-silver border-white/10 hover:border-white/20 hover:text-white bg-white/5'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="flex items-start gap-3 p-4 rounded-savron border border-accent-blue/20 bg-accent-blue/5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeMembershipPass}
                                onChange={e => {
                                    setIncludeMembershipPass(e.target.checked);
                                    if (e.target.checked && !subject.trim()) {
                                        setSubject(defaultPassSubject);
                                    }
                                }}
                                className="admin-checkbox mt-1"
                            />
                            <div className="space-y-1">
                                <span className="flex items-center gap-2 text-sm text-white">
                                    <Wallet className="w-4 h-4 text-accent-blue" />
                                    Include ePass membership (Apple &amp; Google Wallet)
                                </span>
                                <p className="text-xs text-savron-silver/70 leading-relaxed">
                                    Sends the full membership pass email via Resend with .pkpass attachment and wallet buttons.
                                    Only E-Pass subscribers receive passes — CRM-only clients are skipped automatically.
                                </p>
                            </div>
                        </label>

                        {includeMembershipPass && (
                            <div className="space-y-4 p-4 rounded-savron border border-white/10 bg-white/[0.02]">
                                <div>
                                    <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">When to send</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSendTiming('now')}
                                            className={cn(
                                                'py-3 px-3 text-[10px] uppercase tracking-widest border rounded-savron transition-all flex items-center justify-center gap-2',
                                                sendTiming === 'now'
                                                    ? 'bg-savron-green text-white border-savron-green-light/20'
                                                    : 'text-savron-silver border-white/10 hover:border-white/20 hover:text-white bg-white/5',
                                            )}
                                        >
                                            <Send className="w-3.5 h-3.5" /> Send now
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSendTiming('scheduled')}
                                            className={cn(
                                                'py-3 px-3 text-[10px] uppercase tracking-widest border rounded-savron transition-all flex items-center justify-center gap-2',
                                                sendTiming === 'scheduled'
                                                    ? 'bg-savron-green text-white border-savron-green-light/20'
                                                    : 'text-savron-silver border-white/10 hover:border-white/20 hover:text-white bg-white/5',
                                            )}
                                        >
                                            <CalendarClock className="w-3.5 h-3.5" /> Schedule
                                        </button>
                                    </div>
                                </div>
                                {sendTiming === 'scheduled' && (
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">Scheduled date &amp; time</label>
                                        <input
                                            type="datetime-local"
                                            value={scheduledAt}
                                            onChange={e => setScheduledAt(e.target.value)}
                                            className="input-savron"
                                            required={sendTiming === 'scheduled'}
                                        />
                                        <p className="text-[10px] text-savron-silver/50 mt-2 uppercase tracking-widest flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Passes send automatically within 5 minutes of this time
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">Subject Line</label>
                            <input 
                                type="text" 
                                required 
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="input-savron"
                                placeholder={includeMembershipPass ? defaultPassSubject : 'E.g. Special Holiday Offer from SAVRON'}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">
                                {includeMembershipPass ? 'Custom message in pass email (optional)' : 'Email Content (Plain text supports paragraphs)'}
                            </label>
                            <textarea 
                                required={!includeMembershipPass}
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                rows={10}
                                className="input-savron resize-none"
                                placeholder={includeMembershipPass
                                    ? 'Optional note shown above the wallet buttons. Leave blank for the default pass message.'
                                    : 'Type your message here...'}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={sending || !subject || sendCount === 0 || (!includeMembershipPass && !content)}
                            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-savron-green text-white border border-savron-green-light/20 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-savron-green-light transition-all rounded-savron disabled:opacity-50"
                        >
                            {sending
                                ? (includeMembershipPass ? 'Processing pass send...' : 'Sending Campaign...')
                                : includeMembershipPass
                                    ? sendTiming === 'scheduled'
                                        ? `Schedule Pass for ${sendCount} Member${sendCount !== 1 ? 's' : ''}`
                                        : `Send Pass to ${sendCount} Member${sendCount !== 1 ? 's' : ''}`
                                    : `Send to ${sendCount} Recipient${sendCount !== 1 ? 's' : ''}`}
                            {!sending && (includeMembershipPass ? <Wallet size={14} /> : <Send size={14} />)}
                        </button>
                    </form>
                </div>

                <div className="space-y-6">
                    <div className="card-savron">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                                <Users className="text-savron-silver w-4 h-4" />
                                <h3 className="text-xs uppercase tracking-widest text-white">Recipients</h3>
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-savron-silver">
                                {selectedRecipients.length}/{activeRecipients.length}
                                {includeMembershipPass && ` · ${passEligibleRecipients.length} ePass`}
                            </span>
                        </div>

                        {activeRecipients.length === 0 ? (
                            <p className="text-sm text-savron-silver/70">No recipients with email addresses in this group.</p>
                        ) : (
                            <>
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-savron-silver/50" />
                                    <input
                                        type="text"
                                        value={recipientSearch}
                                        onChange={e => setRecipientSearch(e.target.value)}
                                        placeholder="Search recipients..."
                                        className="input-savron pl-9 py-2 text-sm"
                                    />
                                </div>

                                <label className="flex items-center gap-2 px-1 py-2 border-b border-white/5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={allFilteredSelected}
                                        onChange={toggleAllFiltered}
                                        className="admin-checkbox"
                                    />
                                    <span className="text-[10px] uppercase tracking-widest text-savron-silver">
                                        {allFilteredSelected ? 'Deselect filtered' : 'Select filtered'}
                                    </span>
                                </label>

                                <div className="max-h-[420px] overflow-y-auto -mx-1 px-1 space-y-1">
                                    {filteredRecipients.map(recipient => {
                                        const key = recipient.email.toLowerCase();
                                        const checked = selectedEmails.has(key);
                                        return (
                                            <label
                                                key={key}
                                                className={cn(
                                                    'flex items-start gap-3 p-3 rounded-savron border cursor-pointer transition-colors',
                                                    checked
                                                        ? 'bg-savron-green/10 border-savron-green/20'
                                                        : 'bg-white/[0.02] border-white/5 hover:border-white/10',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleRecipient(recipient.email)}
                                                    className="admin-checkbox mt-0.5 shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-white text-sm truncate flex items-center gap-2">
                                                        {recipient.name || 'No name'}
                                                        {includeMembershipPass && subscriberEmailSet.has(key) && (
                                                            <span className="text-[9px] uppercase tracking-widest text-accent-blue shrink-0">ePass</span>
                                                        )}
                                                        {includeMembershipPass && !subscriberEmailSet.has(key) && (
                                                            <span className="text-[9px] uppercase tracking-widest text-amber-400/70 shrink-0">CRM only</span>
                                                        )}
                                                    </p>
                                                    <p className="text-savron-silver text-xs truncate">{recipient.email}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {filteredRecipients.length === 0 && (
                                        <p className="text-center text-savron-silver/50 text-sm py-8">No recipients match your search.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="card-savron">
                        <div className="flex items-center gap-3 mb-4">
                            <Mail className="text-savron-silver w-4 h-4" />
                            <h3 className="text-xs uppercase tracking-widest text-white">
                                {includeMembershipPass ? 'ePass Delivery' : 'Email Delivery'}
                            </h3>
                        </div>
                        <p className="text-sm text-savron-silver/70 font-light leading-relaxed">
                            {includeMembershipPass
                                ? 'Membership passes send through Resend with Apple Wallet (.pkpass) and Google Wallet save links. Scheduled sends run every 5 minutes via cron.'
                                : 'Campaign emails send through Resend to each selected recipient individually. Works for CRM clients, ePass subscribers, or both.'}
                        </p>
                        {!includeMembershipPass && (
                        <ul className="mt-4 space-y-2">
                            <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-light border-b border-white/5 pb-2 min-w-0">
                                <span className="text-savron-silver shrink-0">Provider:</span>
                                <span className="text-white truncate">Resend</span>
                            </li>
                            <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-light border-b border-white/5 pb-2 min-w-0">
                                <span className="text-savron-silver shrink-0">Sender:</span>
                                <span className="text-white truncate">bookings@savronmn.com</span>
                            </li>
                        </ul>
                        )}
                        {includeMembershipPass && (
                        <ul className="mt-4 space-y-2">
                            <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-light border-b border-white/5 pb-2 min-w-0">
                                <span className="text-savron-silver shrink-0">Provider:</span>
                                <span className="text-white truncate">Resend</span>
                            </li>
                            <li className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-light border-b border-white/5 pb-2 min-w-0">
                                <span className="text-savron-silver shrink-0">Includes:</span>
                                <span className="text-white truncate">Apple .pkpass + Google Wallet</span>
                            </li>
                        </ul>
                        )}
                    </div>
                </div>
            </div>

            <div className="card-savron">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                        <History className="text-savron-silver w-4 h-4" />
                        <div>
                            <h2 className="font-heading text-lg uppercase tracking-widest text-white">Send History</h2>
                            <p className="text-savron-silver/70 text-[11px] uppercase tracking-widest mt-0.5">
                                Recent emails sent through Resend
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void fetchHistory()}
                        disabled={historyLoading}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white hover:border-white/20 rounded-savron transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={cn('w-3.5 h-3.5', historyLoading && 'animate-spin')} />
                        Refresh
                    </button>
                </div>

                {historyError && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-savron flex items-center gap-3">
                        <AlertCircle size={16} />
                        <span className="text-xs uppercase tracking-widest">{historyError}</span>
                    </div>
                )}

                {historyLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="py-12 text-center">
                        <Mail className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                        <p className="text-savron-silver/50 text-sm uppercase tracking-wider">No sent emails found in Resend yet</p>
                    </div>
                ) : (
                    <>
                        <div className="md:hidden space-y-3">
                            {history.map(email => (
                                <div key={email.id} className="p-4 border border-white/[0.06] rounded-savron bg-white/[0.02] space-y-2">
                                    <p className="text-sm text-white">{email.subject || '(No subject)'}</p>
                                    <p className="text-xs text-savron-silver">{formatHistoryDate(email.created_at)}</p>
                                    <p className="text-xs text-savron-silver/70 truncate">To: {email.to.join(', ') || '—'}</p>
                                    <p className="text-xs text-savron-silver/70 truncate">From: {email.from || '—'}</p>
                                    <span className={cn(
                                        'inline-flex px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-widest',
                                        eventBadgeClass(email.last_event),
                                    )}>
                                        {email.last_event?.replace(/_/g, ' ') || 'sent'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="hidden md:block overflow-x-auto -mx-1 min-w-0">
                            <table className="w-full min-w-[720px] text-left">
                                <thead>
                                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-savron-silver/60">
                                        <th className="px-3 py-3 font-medium">Sent</th>
                                        <th className="px-3 py-3 font-medium">Subject</th>
                                        <th className="px-3 py-3 font-medium">Recipient</th>
                                        <th className="px-3 py-3 font-medium">From</th>
                                        <th className="px-3 py-3 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(email => (
                                        <tr key={email.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-3 py-4 text-xs text-savron-silver whitespace-nowrap">
                                                {formatHistoryDate(email.created_at)}
                                            </td>
                                            <td className="px-3 py-4 text-sm text-white max-w-[240px]">
                                                <span className="block truncate">{email.subject || '(No subject)'}</span>
                                            </td>
                                            <td className="px-3 py-4 text-xs text-savron-silver max-w-[220px]">
                                                <span className="block truncate">{email.to.join(', ') || '—'}</span>
                                            </td>
                                            <td className="px-3 py-4 text-xs text-savron-silver max-w-[180px]">
                                                <span className="block truncate">{email.from || '—'}</span>
                                            </td>
                                            <td className="px-3 py-4">
                                                <span className={cn(
                                                    'inline-flex px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-widest',
                                                    eventBadgeClass(email.last_event),
                                                )}>
                                                    {email.last_event?.replace(/_/g, ' ') || 'sent'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {historyHasMore && (
                            <div className="pt-5 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => void fetchHistory({ after: history[history.length - 1]?.id, append: true })}
                                    disabled={historyLoadingMore}
                                    className="flex items-center gap-2 px-5 py-2.5 text-[10px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white hover:border-white/20 rounded-savron transition-all disabled:opacity-50"
                                >
                                    {historyLoadingMore ? 'Loading...' : 'Load more'}
                                    {!historyLoadingMore && <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
