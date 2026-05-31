"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Clock, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type Barber = { id: string; name: string };
type ChangeRequest = {
    id: string;
    type: 'schedule' | 'price' | 'service' | 'profile';
    payload: any;
    reason: string | null;
    status: 'pending' | 'approved' | 'rejected';
    admin_note: string | null;
    created_at: string;
    resolved_at: string | null;
};

type RequestType = 'schedule' | 'price' | 'service' | 'profile';

const TYPE_OPTIONS: { value: RequestType; label: string; helper: string }[] = [
    { value: 'schedule', label: 'Schedule', helper: 'Change your working hours' },
    { value: 'service', label: 'Service Menu', helper: 'Add or remove services you offer' },
    { value: 'price', label: 'Price', helper: 'Propose a price update for a service' },
    { value: 'profile', label: 'Profile', helper: 'Update your bio, specialties, or socials' },
];

export default function BarberRequestsPage() {
    const supabase = createClient();
    const router = useRouter();
    const [barber, setBarber] = useState<Barber | null>(null);
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [type, setType] = useState<RequestType>('schedule');
    const [payloadText, setPayloadText] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/barber/login'); return; }
            const { data: b } = await supabase.from('barbers').select('id, name').eq('auth_id', user.id).single();
            if (!b) { setLoading(false); return; }
            setBarber(b as Barber);
            const { data: rs } = await supabase
                .from('barber_change_requests')
                .select('*')
                .eq('barber_id', b.id)
                .order('created_at', { ascending: false });
            if (rs) setRequests(rs as ChangeRequest[]);
            setLoading(false);
        }
        load();
    }, []);

    async function submit() {
        if (!barber) return;
        let payload: any;
        try {
            payload = payloadText.trim() ? JSON.parse(payloadText) : {};
        } catch {
            setError('Proposed change must be valid JSON. Tip: copy a template from the helper.');
            return;
        }

        setSubmitting(true);
        setError(null);
        const { data, error } = await supabase.from('barber_change_requests').insert({
            barber_id: barber.id,
            type,
            payload,
            reason: reason.trim() || null,
            status: 'pending',
        }).select('*').single();

        setSubmitting(false);
        if (error) { setError(error.message); return; }
        if (data) {
            setRequests([data as ChangeRequest, ...requests]);
            setShowForm(false);
            setPayloadText('');
            setReason('');
        }
    }

    function templateFor(t: RequestType) {
        switch (t) {
            case 'schedule':
                return JSON.stringify({ monday: { start: '10:00', end: '18:00' }, tuesday: 'off' }, null, 2);
            case 'service':
                return JSON.stringify({ services_offered: ['Signature Cut', 'Beard Sculpting + Hot Towel Shave'] }, null, 2);
            case 'price':
                return JSON.stringify({ service_id: 'paste-service-uuid-here', price_cents: 6000 }, null, 2);
            case 'profile':
                return JSON.stringify({ bio: 'Updated bio…', specialties: ['Fades', 'Hot Towel'], instagram_url: 'https://instagram.com/handle' }, null, 2);
        }
    }

    const statusBadge = (s: ChangeRequest['status']) => {
        if (s === 'pending') return <span className="badge-pending flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
        if (s === 'approved') return <span className="badge-approved flex items-center gap-1"><Check className="w-3 h-3" /> Approved</span>;
        return <span className="badge-rejected flex items-center gap-1"><X className="w-3 h-3" /> Rejected</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    if (!barber) return <p className="text-savron-silver">Barber profile not found.</p>;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 max-w-4xl">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Change Requests</h1>
                    <p className="text-savron-silver text-sm mt-1">Submit a request — an admin will review and apply approved changes.</p>
                </div>
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="px-5 py-3 text-[11px] uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 hover:bg-savron-green-light rounded-savron transition-all flex items-center gap-2"
                >
                    <Send className="w-3.5 h-3.5" />
                    {showForm ? 'Cancel' : 'New Request'}
                </button>
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="bg-savron-grey border border-savron-green/20 rounded-savron p-6 space-y-5"
                    >
                        <h3 className="font-heading uppercase tracking-widest text-white text-sm">New Change Request</h3>

                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Type</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {TYPE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => { setType(opt.value); setPayloadText(templateFor(opt.value)); }}
                                        className={cn(
                                            "p-3 border rounded-savron text-left transition-all",
                                            type === opt.value
                                                ? "border-savron-green/50 bg-savron-green/10"
                                                : "border-white/10 hover:border-white/25"
                                        )}
                                    >
                                        <p className="text-white text-xs uppercase tracking-widest">{opt.label}</p>
                                        <p className="text-savron-silver/50 text-[10px] mt-1 leading-relaxed">{opt.helper}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">
                                Proposed Change (JSON)
                            </label>
                            <textarea
                                value={payloadText}
                                onChange={(e) => setPayloadText(e.target.value)}
                                rows={8}
                                placeholder={templateFor(type)}
                                className="w-full bg-savron-black border border-white/10 text-white px-4 py-3 text-xs font-mono rounded-savron resize-none focus:border-savron-green/50 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Reason (Optional)</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={2}
                                placeholder="Why are you requesting this?"
                                className="input-savron resize-none"
                            />
                        </div>

                        {error && <p className="text-red-400 text-xs">{error}</p>}

                        <button
                            onClick={submit}
                            disabled={submitting}
                            className="px-6 py-3 bg-savron-green/90 text-white text-[11px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <Send className="w-3.5 h-3.5" /> {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {requests.length === 0 ? (
                <div className="text-center py-16 border border-white/5 rounded-savron">
                    <Send className="w-7 h-7 text-savron-silver/20 mx-auto mb-3" />
                    <p className="text-savron-silver/70 text-xs uppercase tracking-widest">No requests submitted yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(r => (
                        <details key={r.id} className="bg-savron-grey border border-white/5 rounded-savron group">
                            <summary className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors list-none">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <ChevronDown className="w-4 h-4 text-savron-silver/70 transition-transform group-open:rotate-180" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm">
                                            {TYPE_OPTIONS.find(o => o.value === r.type)?.label} change
                                        </p>
                                        <p className="text-savron-silver/50 text-[11px] mt-0.5">{format(new Date(r.created_at), 'MMM d, h:mm a')}</p>
                                    </div>
                                </div>
                                {statusBadge(r.status)}
                            </summary>
                            <div className="px-5 pb-5 space-y-3 border-t border-white/5">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/70 mt-3 mb-2">Proposed</p>
                                    <pre className="bg-savron-black border border-white/5 rounded-savron p-3 text-xs text-savron-silver overflow-x-auto">
{JSON.stringify(r.payload, null, 2)}
                                    </pre>
                                </div>
                                {r.reason && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/70 mb-1">Reason</p>
                                        <p className="text-savron-silver text-sm">{r.reason}</p>
                                    </div>
                                )}
                                {r.admin_note && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/70 mb-1">Admin Response</p>
                                        <p className="text-savron-silver text-sm">{r.admin_note}</p>
                                    </div>
                                )}
                            </div>
                        </details>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
