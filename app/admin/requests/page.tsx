"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, MessageSquare, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type ChangeRequest = {
    id: string;
    barber_id: string;
    type: 'schedule' | 'price' | 'service' | 'profile';
    payload: any;
    reason: string | null;
    status: 'pending' | 'approved' | 'rejected';
    admin_note: string | null;
    created_at: string;
    resolved_at: string | null;
    barbers?: { name: string };
};

const TYPE_LABELS: Record<ChangeRequest['type'], string> = {
    schedule: 'Schedule',
    price: 'Price',
    service: 'Service Menu',
    profile: 'Profile',
};

export default function AdminRequestsPage() {
    const supabase = createClient();
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'all'>('pending');
    const [actingOn, setActingOn] = useState<string | null>(null);
    const [adminNote, setAdminNote] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        const query = supabase
            .from('barber_change_requests')
            .select('*, barbers(name)')
            .order('created_at', { ascending: false });

        const { data } = filter === 'pending'
            ? await query.eq('status', 'pending')
            : await query.limit(100);

        if (data) setRequests(data as ChangeRequest[]);
        setLoading(false);
    }

    useEffect(() => { load(); }, [filter]);

    async function handleApprove(id: string) {
        setActingOn(id);
        const res = await fetch('/api/requests/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: id, adminNote: adminNote.trim() || undefined }),
        });
        setActingOn(null);
        setAdminNote('');
        setExpanded(null);
        if (res.ok) await load();
        else alert('Failed to approve. Check console.');
    }

    async function handleReject(id: string) {
        setActingOn(id);
        const res = await fetch('/api/requests/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: id, adminNote: adminNote.trim() || undefined }),
        });
        setActingOn(null);
        setAdminNote('');
        setExpanded(null);
        if (res.ok) await load();
        else alert('Failed to reject. Check console.');
    }

    const statusBadge = (s: ChangeRequest['status']) => {
        if (s === 'pending') return <span className="badge-pending">Pending</span>;
        if (s === 'approved') return <span className="badge-approved">Approved</span>;
        return <span className="badge-rejected">Rejected</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Change Requests</h1>
                    <p className="text-savron-silver text-sm mt-1">{requests.length} {filter === 'pending' ? 'pending' : 'total'} request{requests.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                    {(['pending', 'all'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-4 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                                filter === f
                                    ? "border-savron-green/30 bg-savron-green/10 text-savron-green"
                                    : "border-white/10 text-savron-silver hover:text-white hover:border-white/20"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-20">
                    <Inbox className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                    <p className="text-savron-silver/30 text-sm uppercase tracking-widest">No {filter === 'pending' ? 'pending' : ''} requests</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(r => {
                        const isExpanded = expanded === r.id;
                        return (
                            <motion.div
                                key={r.id}
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-savron-grey border border-white/5 rounded-savron"
                            >
                                <button
                                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <Clock className="w-4 h-4 text-savron-silver/40 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium">
                                                {r.barbers?.name ?? 'Unknown barber'} · {TYPE_LABELS[r.type]} change
                                            </p>
                                            <p className="text-savron-silver/50 text-[11px] mt-0.5">
                                                {format(new Date(r.created_at), 'MMM d, h:mm a')}
                                                {r.reason && ` · "${r.reason.slice(0, 60)}${r.reason.length > 60 ? '…' : ''}"`}
                                            </p>
                                        </div>
                                    </div>
                                    {statusBadge(r.status)}
                                </button>

                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-t border-white/5"
                                        >
                                            <div className="p-5 space-y-4">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-2">Proposed Change</p>
                                                    <pre className="bg-savron-black border border-white/5 rounded-savron p-3 text-xs text-savron-silver overflow-x-auto">
{JSON.stringify(r.payload, null, 2)}
                                                    </pre>
                                                </div>

                                                {r.reason && (
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-2 flex items-center gap-1">
                                                            <MessageSquare className="w-3 h-3" /> Reason
                                                        </p>
                                                        <p className="text-savron-silver text-sm">{r.reason}</p>
                                                    </div>
                                                )}

                                                {r.status === 'pending' ? (
                                                    <>
                                                        <textarea
                                                            value={adminNote}
                                                            onChange={(e) => setAdminNote(e.target.value)}
                                                            placeholder="ADMIN NOTE (OPTIONAL)"
                                                            rows={2}
                                                            className="input-savron resize-none"
                                                        />
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={() => handleApprove(r.id)}
                                                                disabled={actingOn === r.id}
                                                                className="flex-1 py-3 text-[11px] uppercase tracking-widest bg-savron-green/15 text-savron-green border border-savron-green/25 hover:bg-savron-green/25 rounded-savron transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> Approve & Apply
                                                            </button>
                                                            <button
                                                                onClick={() => handleReject(r.id)}
                                                                disabled={actingOn === r.id}
                                                                className="flex-1 py-3 text-[11px] uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 rounded-savron transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                            >
                                                                <X className="w-3.5 h-3.5" /> Reject
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : r.admin_note && (
                                                    <div className="bg-savron-black border border-white/5 rounded-savron p-3">
                                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-1">Admin Note</p>
                                                        <p className="text-savron-silver text-sm">{r.admin_note}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
}
