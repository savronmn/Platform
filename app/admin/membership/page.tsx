"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase';
import type { EmailSubscriber } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCheck, Clock, Send, Plus, RefreshCw, UserPlus, X, Minus, Trash2, ScanLine, Edit3, Check, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const QRScannerModal = dynamic(() => import('@/components/qr/QRScannerModal'), { ssr: false });

export default function MembershipPage() {
    const supabase = createClient();
    const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', email: '', phone: '' });
    const [addLoading, setAddLoading] = useState(false);
    const [selected, setSelected] = useState<EmailSubscriber | null>(null);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', email: '', phone: '' });
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 3200);
    };

    useEffect(() => {
        fetchSubscribers();
    }, []);

    async function fetchSubscribers() {
        setLoading(true);
        const { data, error } = await supabase
            .from('email_subscribers')
            .select('*')
            .order('issued_at', { ascending: false });
        if (!error && data) setSubscribers(data);
        setLoading(false);
    }

    async function handleAddMember() {
        if (!addForm.name.trim() || !addForm.email.trim()) return;
        setAddLoading(true);
        try {
            const res = await fetch('/api/wallet/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: addForm.name.trim(),
                    email: addForm.email.trim(),
                    phone: addForm.phone.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`${addForm.name.trim()} added — pass sent to ${addForm.email.trim()}`);
                setAddForm({ name: '', email: '', phone: '' });
                setShowAddForm(false);
                fetchSubscribers();
            } else if (res.status === 409) {
                showToast('This email is already on the list.', 'error');
            } else {
                showToast(data?.error || 'Failed to add member', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setAddLoading(false);
        }
    }

    async function recordVisit(subscriber: EmailSubscriber) {
        setActionLoading(`visit-${subscriber.id}`);
        try {
            const res = await fetch('/api/wallet/record-visit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriber_id: subscriber.id, action: 'record_visit' }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSubscribers(prev =>
                    prev.map(s => s.id === subscriber.id
                        ? { ...s, visit_count: data.visit_count, last_visit_at: new Date().toISOString() }
                        : s
                    )
                );
                showToast(
                    `Visit recorded — ${subscriber.name} now has ${data.visit_count} visit${data.visit_count === 1 ? '' : 's'}.` +
                    (data.google_wallet_updated ? ' Google Wallet updated.' : ' Google Wallet did not update automatically.')
                );
            } else {
                showToast(data.error || 'Failed to record visit', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setActionLoading(null);
        }
    }

    async function removeVisit(subscriber: EmailSubscriber) {
        if (subscriber.visit_count <= 0) return;
        setActionLoading(`remove-visit-${subscriber.id}`);
        try {
            const res = await fetch('/api/wallet/record-visit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriber_id: subscriber.id, action: 'remove_visit' }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSubscribers(prev =>
                    prev.map(s => s.id === subscriber.id
                        ? { ...s, visit_count: data.visit_count }
                        : s
                    )
                );
                showToast(
                    `Visit removed — ${subscriber.name} now has ${data.visit_count} visit${data.visit_count === 1 ? '' : 's'}.` +
                    (data.google_wallet_updated ? ' Google Wallet updated.' : ' Google Wallet did not update automatically.')
                );
            } else {
                showToast(data.error || 'Failed to remove visit', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setActionLoading(null);
        }
    }

    async function saveMemberEdit() {
        if (!selected) return;
        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch('/api/wallet/record-visit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriber_id: selected.id,
                    action: 'update_profile',
                    name: editData.name.trim(),
                    email: editData.email.trim(),
                    phone: editData.phone.trim() || null,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSubscribers(prev =>
                    prev.map(s => s.id === selected.id ? { ...s, ...data.subscriber } : s)
                );
                showToast(
                    `Updated ${editData.name.trim()}` +
                    (data.google_wallet_updated ? ' — Google Wallet synced.' : '')
                );
                setEditing(false);
                setSelected(null);
            } else if (res.status === 409) {
                setSaveError('That email is already on the membership list.');
            } else {
                setSaveError(data?.error || 'Failed to update member');
            }
        } catch {
            setSaveError('Network error');
        } finally {
            setSaving(false);
        }
    }

    function openMemberDetail(subscriber: EmailSubscriber) {
        setSelected(subscriber);
        setEditData({
            name: subscriber.name,
            email: subscriber.email,
            phone: subscriber.phone || '',
        });
        setEditing(false);
        setSaveError(null);
    }

    async function deleteMember(subscriber: EmailSubscriber) {
        if (!confirm(`Are you sure you want to permanently delete ${subscriber.name}? This removes them from the CRM and they will lose access to their pass.`)) return;
        setActionLoading(`delete-${subscriber.id}`);
        try {
            const { error } = await supabase.from('email_subscribers').delete().eq('id', subscriber.id);
            if (error) {
                showToast('Failed to delete member', 'error');
            } else {
                setSubscribers(prev => prev.filter(s => s.id !== subscriber.id));
                showToast(`Member ${subscriber.name} deleted successfully.`);
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setActionLoading(null);
        }
    }

    async function sendUpdatedPass(subscriber: EmailSubscriber) {
        setActionLoading(`pass-${subscriber.id}`);
        try {
            const res = await fetch('/api/wallet/record-visit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriber_id: subscriber.id, action: 'send_updated_pass' }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(`Updated Apple pass sent to ${subscriber.email}`);
            } else {
                showToast(data.error || 'Failed to send pass', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setActionLoading(null);
        }
    }

    const filtered = subscribers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.phone && s.phone.includes(search))
    );

    const totalVisits = subscribers.reduce((sum, s) => sum + s.visit_count, 0);

    const inputStyle = "w-full bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3 text-sm font-light tracking-wide focus:outline-none focus:border-white/20 transition-colors";

    return (
        <div className="admin-page text-white">
            <QRScannerModal
                open={showScanner}
                onClose={() => setShowScanner(false)}
                onScanSuccess={(sub, meta) => {
                    setSubscribers(prev =>
                        prev.map(s => s.id === sub.id
                            ? { ...s, visit_count: sub.visit_count, last_visit_at: sub.last_visit_at ?? new Date().toISOString() }
                            : s
                        )
                    );
                    showToast(
                        `Visit recorded — ${sub.name} now has ${sub.visit_count} visit${sub.visit_count === 1 ? '' : 's'}.` +
                        (meta?.google_wallet_updated ? ' Google Wallet updated.' : ' Google Wallet did not update automatically.')
                    );
                }}
            />
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className={cn(
                            "fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[9999] px-4 py-3.5 text-xs font-light tracking-wide backdrop-blur-md rounded-savron border",
                            toast.type === 'success'
                                ? "bg-savron-green/95 border-savron-blue/30 text-accent-blue"
                                : "bg-red-950/95 border-red-500/20 text-red-300"
                        )}
                    >
                        {toast.text}
                    </motion.div>
                )}
            </AnimatePresence>
                {/* Header */}
                <div className="admin-header">
                    <div>
                        <p className="admin-kicker">Membership</p>
                        <h1 className="admin-title">E-Pass Subscribers</h1>
                        <p className="admin-subtitle">
                            Manage digital passes, record visits, and track engagement.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setShowScanner(true)}
                            className="flex items-center gap-1.5 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-accent-blue border border-savron-green-light/20 rounded-savron hover:bg-savron-green/10 transition-all"
                        >
                            <ScanLine size={12} />
                            Scan ePass
                        </button>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-1.5 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60 border border-white/[0.1] rounded-savron hover:border-savron-green/40 hover:text-white hover:bg-savron-green/5 transition-all"
                        >
                            <UserPlus size={12} />
                            Add Member
                        </button>
                        <button
                            onClick={fetchSubscribers}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60 border border-white/[0.1] rounded-savron hover:border-white/25 hover:text-white transition-all disabled:opacity-40"
                        >
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Quick Add Form */}
                <AnimatePresence>
                    {showAddForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-8"
                        >
                            <div className="card-savron space-y-5">
                                <div className="flex items-center justify-between mb-5">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">
                                        Add New Member — sends pass via email
                                    </p>
                                    <button onClick={() => setShowAddForm(false)} className="text-white/30 hover:text-white transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Full Name *"
                                        value={addForm.name}
                                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                        className={inputStyle}
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email Address *"
                                        value={addForm.email}
                                        onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                                        className={inputStyle}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Phone (optional)"
                                        value={addForm.phone}
                                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                                        className={inputStyle}
                                    />
                                    <button
                                        onClick={handleAddMember}
                                        disabled={addLoading || !addForm.name.trim() || !addForm.email.trim()}
                                        className="flex items-center justify-center gap-2 px-4 py-3 text-[10px] uppercase tracking-[0.2em] bg-savron-green text-white border border-savron-green-light/20 hover:bg-savron-green-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={12} />
                                        {addLoading ? 'Sending…' : 'Add & Send Pass'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-6">
                    {[
                        { icon: UserCheck, label: "Total Subscribers", value: subscribers.length.toString() },
                        { icon: Plus, label: "Total Visits Recorded", value: totalVisits.toString() },
                        { icon: Clock, label: "This Month", value: subscribers.filter(s => {
                            const d = new Date(s.issued_at);
                            const now = new Date();
                            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                        }).length.toString() },
                    ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="card-savron">
                            <div className="flex items-center gap-3 mb-3">
                                <Icon size={14} className="text-white/30" />
                                <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">{label}</p>
                            </div>
                            <p className="text-3xl font-light text-white">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div className="relative card-savron p-0 overflow-hidden">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-transparent text-white placeholder-white/25 pl-10 pr-4 py-4 text-sm font-light tracking-wide focus:outline-none transition-colors"
                    />
                </div>

                {/* Table */}
                {loading ? (
                    <div className="text-center py-20 text-white/30 text-sm tracking-widest uppercase">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-white/25 text-sm tracking-widest uppercase">
                        {search ? 'No results found' : 'No subscribers yet — use the form above or the footer signup to add members'}
                    </div>
                ) : (
                    <div className="card-savron p-0 overflow-hidden">
                        {/* Header row */}
                        <div className="hidden md:grid gap-4 px-6 py-4 border-b border-white/[0.06]"
                            style={{ gridTemplateColumns: "2fr 2fr 1fr 80px 80px 240px" }}
                        >
                            {['Name', 'Email', 'Phone', 'Visits', 'Joined', 'Actions'].map(h => (
                                <p key={h} className="text-[9px] uppercase tracking-[0.3em] text-white/25">{h}</p>
                            ))}
                        </div>

                        {/* Rows */}
                        {filtered.map((subscriber, i) => (
                            <motion.div
                                key={subscriber.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.03 }}
                                className="border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors cursor-pointer group"
                                onClick={() => openMemberDetail(subscriber)}
                            >
                                {/* Desktop Row */}
                                <div className="hidden md:grid gap-4 px-6 py-5 items-center"
                                     style={{ gridTemplateColumns: "2fr 2fr 1fr 80px 80px 240px" }}
                                >
                                    {/* Name */}
                                    <div>
                                        <p className="text-sm text-white font-light">{subscriber.name}</p>
                                        {subscriber.last_visit_at && (
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Last visit {formatDistanceToNow(new Date(subscriber.last_visit_at), { addSuffix: true })}
                                            </p>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <p className="text-xs text-white/50 font-light truncate">{subscriber.email}</p>

                                    {/* Phone */}
                                    <p className="text-xs text-white/40 font-light">{subscriber.phone || '—'}</p>

                                    {/* Visits */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-light text-white">{subscriber.visit_count}</span>
                                    </div>

                                    {/* Joined */}
                                    <p className="text-[10px] text-white/30">
                                        {formatDistanceToNow(new Date(subscriber.issued_at), { addSuffix: true })}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openMemberDetail(subscriber)}
                                            title="Edit member"
                                            className="flex items-center justify-center w-7 h-7 text-white/40 border border-white/[0.1] rounded-full hover:border-white/25 hover:text-white hover:bg-white/5 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                        >
                                            <Edit3 size={10} />
                                        </button>
                                        <button
                                            onClick={() => removeVisit(subscriber)}
                                            disabled={actionLoading === `remove-visit-${subscriber.id}` || subscriber.visit_count <= 0}
                                            title="Remove visit (-1 count)"
                                            className="flex items-center justify-center w-7 h-7 text-white/50 border border-white/[0.1] rounded-full hover:border-yellow-500/40 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all disabled:opacity-40"
                                        >
                                            <Minus size={10} />
                                        </button>
                                        <button
                                            onClick={() => recordVisit(subscriber)}
                                            disabled={actionLoading === `visit-${subscriber.id}`}
                                            title="Record visit (+1 count, updates Google Wallet)"
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/50 border border-white/[0.1] hover:border-savron-green/40 hover:text-accent-blue hover:bg-savron-green/10 transition-all disabled:opacity-40"
                                        >
                                            <Plus size={10} />
                                            {actionLoading === `visit-${subscriber.id}` ? '…' : 'Visit'}
                                        </button>
                                        <button
                                            onClick={() => sendUpdatedPass(subscriber)}
                                            disabled={actionLoading === `pass-${subscriber.id}`}
                                            title="Re-send updated Apple Wallet pass via email"
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-white/50 border border-white/[0.1] hover:border-white/25 hover:text-white transition-all disabled:opacity-40"
                                        >
                                            <Send size={10} />
                                            {actionLoading === `pass-${subscriber.id}` ? '…' : 'Pass'}
                                        </button>
                                        <button
                                            onClick={() => deleteMember(subscriber)}
                                            disabled={actionLoading === `delete-${subscriber.id}`}
                                            title="Delete Member"
                                            className="flex items-center justify-center w-7 h-7 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all disabled:opacity-40 ml-1"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                {/* Mobile Card */}
                                <div className="block md:hidden p-5 space-y-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-white font-medium truncate">{subscriber.name}</p>
                                            <p className="text-xs text-white/50 font-light truncate mt-0.5">{subscriber.email}</p>
                                            {subscriber.phone && <p className="text-xs text-white/40 font-light mt-0.5">{subscriber.phone}</p>}
                                            <p className="text-[10px] text-white/30 mt-1">
                                                Joined {formatDistanceToNow(new Date(subscriber.issued_at), { addSuffix: true })}
                                            </p>
                                            {subscriber.last_visit_at && (
                                                <p className="text-[10px] text-white/30 mt-1">
                                                    Last visit: {formatDistanceToNow(new Date(subscriber.last_visit_at), { addSuffix: true })}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-savron-silver text-[9px] uppercase tracking-widest font-medium block">Visits</span>
                                            <span className="text-2xl font-light text-white font-heading block mt-0.5">{subscriber.visit_count}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3.5 border-t border-white/5" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => openMemberDetail(subscriber)}
                                                className="admin-icon-btn text-white/40 border border-white/[0.1] rounded-full hover:border-white/25 hover:text-white hover:bg-white/5 transition-all"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                onClick={() => removeVisit(subscriber)}
                                                disabled={actionLoading === `remove-visit-${subscriber.id}` || subscriber.visit_count <= 0}
                                                className="admin-icon-btn text-white/50 border border-white/[0.1] rounded-full hover:border-yellow-500/40 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all disabled:opacity-40"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <button
                                                onClick={() => recordVisit(subscriber)}
                                                disabled={actionLoading === `visit-${subscriber.id}`}
                                                className="admin-action-btn text-white/50 border border-white/[0.1] hover:border-savron-green/40 hover:text-accent-blue hover:bg-savron-green/10 transition-all disabled:opacity-40 flex-1 sm:flex-none"
                                            >
                                                <Plus size={12} />
                                                {actionLoading === `visit-${subscriber.id}` ? '…' : 'Visit'}
                                            </button>
                                            <button
                                                onClick={() => sendUpdatedPass(subscriber)}
                                                disabled={actionLoading === `pass-${subscriber.id}`}
                                                className="admin-action-btn text-white/50 border border-white/[0.1] hover:border-white/25 hover:text-white transition-all disabled:opacity-40 flex-1 sm:flex-none"
                                            >
                                                <Send size={12} />
                                                {actionLoading === `pass-${subscriber.id}` ? '…' : 'Pass'}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => deleteMember(subscriber)}
                                            disabled={actionLoading === `delete-${subscriber.id}`}
                                            className="admin-icon-btn text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all disabled:opacity-40 self-end sm:self-auto"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                <p className="text-[10px] text-white/20 mt-4 tracking-wider">
                    {filtered.length} of {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
                    &nbsp;·&nbsp; Click a row to edit member info.
                    &nbsp;·&nbsp; Visit button updates Google Wallet live on device + records to DB.
                    Pass button re-sends updated Apple Wallet .pkpass via email.
                </p>

            {/* Member Detail / Edit Modal */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => { setSelected(null); setEditing(false); setSaveError(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-white/5">
                                <div>
                                    <h2 className="text-white font-heading text-xl uppercase tracking-wider">{selected.name}</h2>
                                    <p className="text-savron-silver/60 text-xs mt-1">{selected.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setEditing(!editing); setSaveError(null); }} className="text-savron-silver hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => { setSelected(null); setEditing(false); setSaveError(null); }} className="text-savron-silver hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {editing ? (
                                    <>
                                        <div className="space-y-3">
                                            <input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} placeholder="FULL NAME" className={inputStyle} />
                                            <input type="email" value={editData.email} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} placeholder="EMAIL" className={inputStyle} />
                                            <input type="tel" value={editData.phone} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} placeholder="PHONE" className={inputStyle} />
                                        </div>
                                        {saveError && (
                                            <p className="text-red-400 text-xs flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {saveError}
                                            </p>
                                        )}
                                        <div className="flex justify-end gap-3 pt-2">
                                            <button onClick={() => { setEditing(false); setSaveError(null); }} className="px-4 py-2 text-xs uppercase tracking-widest text-savron-silver border border-white/10 rounded-savron hover:text-white transition-all">Cancel</button>
                                            <button onClick={saveMemberEdit} disabled={saving || !editData.name.trim() || !editData.email.trim()} className="px-4 py-2 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all flex items-center gap-2 disabled:opacity-50">
                                                {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Email</span>
                                                <p className="text-white text-sm">{selected.email}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Phone</span>
                                                <p className="text-white text-sm">{selected.phone || '—'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Visits</span>
                                                <p className="text-white text-sm font-mono">{selected.visit_count}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Joined</span>
                                                <p className="text-white text-sm">{formatDistanceToNow(new Date(selected.issued_at), { addSuffix: true })}</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {!editing && (
                                <div className="p-6 border-t border-white/5 flex justify-end">
                                    <button
                                        onClick={() => setEditing(true)}
                                        className="px-4 py-2 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all flex items-center gap-2"
                                    >
                                        <Edit3 className="w-3 h-3" /> Edit
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
