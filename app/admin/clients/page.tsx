"use client";

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import StatusBadge from '@/components/crm/StatusBadge';
import type { Client } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus, Trash2, Mail, Edit3, Check, AlertTriangle, CreditCard, DollarSign, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInWeeks } from 'date-fns';

type VisitFilter = 'all' | '4_weeks' | '6_weeks' | '8_weeks' | 'vip';
type CampaignTemplate = 'miss_you' | 'special_offer' | 'custom';
type MembershipTier = 'standard' | 'inner_circle' | 'vip';

interface ChargeData {
    amount: string;
    description: string;
    mode: 'redirect' | 'link';
}

export default function ClientsPage() {
    const supabase = createClient();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
    const [selected, setSelected] = useState<Client | null>(null);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Client>>({});
    const [showAdd, setShowAdd] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', notes: '', preferences: '' });
    const [showDelete, setShowDelete] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showCampaign, setShowCampaign] = useState(false);
    const [campaignTemplate, setCampaignTemplate] = useState<CampaignTemplate>('miss_you');
    const [campaignSubject, setCampaignSubject] = useState('');
    const [campaignMessage, setCampaignMessage] = useState('');
    const [campaignOffer, setCampaignOffer] = useState('15% OFF your next visit');
    const [sending, setSending] = useState(false);
    const [campaignResult, setCampaignResult] = useState<{ sent: number; failed: number } | null>(null);

    // Bulk tier move
    const [showTierMove, setShowTierMove] = useState(false);
    const [movingTier, setMovingTier] = useState(false);

    // Stripe charge from client modal
    const [showCharge, setShowCharge] = useState(false);
    const [chargeData, setChargeData] = useState<ChargeData>({ amount: '', description: 'Barbershop Service', mode: 'redirect' });
    const [charging, setCharging] = useState(false);
    const [chargeResult, setChargeResult] = useState<string | null>(null);

    useEffect(() => { fetchClients(); }, [search]);

    async function fetchClients() {
        setLoading(true);
        setFetchError(null);
        const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
        if (error) {
            setFetchError(error.message);
            setLoading(false);
            return;
        }
        let result = data ?? [];
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(c =>
                c.name?.toLowerCase().includes(s) ||
                c.email?.toLowerCase().includes(s) ||
                c.phone?.toLowerCase().includes(s)
            );
        }
        setClients(result);
        setLoading(false);
    }

    const filteredClients = useMemo(() => {
        if (visitFilter === 'all') return clients;
        if (visitFilter === 'vip') return clients.filter(c => c.membership_status === 'vip');
        const weeksMap: Record<string, number> = { '4_weeks': 4, '6_weeks': 6, '8_weeks': 8 };
        const weeks = weeksMap[visitFilter] ?? 6;
        const now = new Date();
        return clients.filter(c => {
            if (!c.last_booking_date) return true;
            try {
                const date = new Date(c.last_booking_date);
                if (isNaN(date.getTime())) return true;
                return differenceInWeeks(now, date) >= weeks;
            } catch {
                return true;
            }
        });
    }, [clients, visitFilter]);

    function getLastVisitInfo(client: Client) {
        if (!client.last_booking_date) return { text: 'Never', color: 'text-savron-silver/70' };
        try {
            const date = new Date(client.last_booking_date);
            if (isNaN(date.getTime())) return { text: 'Invalid Date', color: 'text-savron-silver/70' };
            const weeks = differenceInWeeks(new Date(), date);
            const text = formatDistanceToNow(date, { addSuffix: true });
            if (weeks < 4) return { text, color: 'text-savron-green' };
            if (weeks < 6) return { text, color: 'text-yellow-400' };
            return { text, color: 'text-red-400' };
        } catch {
            return { text: 'Unknown', color: 'text-savron-silver/70' };
        }
    }

    async function addClient(e: React.FormEvent) {
        e.preventDefault();
        await supabase.from('clients').insert(newClient);
        setNewClient({ name: '', email: '', phone: '', notes: '', preferences: '' });
        setShowAdd(false);
        fetchClients();
    }

    async function saveEdit() {
        if (!selected) return;
        await supabase.from('clients').update(editData).eq('id', selected.id);
        setEditing(false);
        setSelected(null);
        fetchClients();
    }

    async function deleteClient(id: string) {
        await supabase.from('clients').delete().eq('id', id);
        setShowDelete(null);
        setSelected(null);
        fetchClients();
    }

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function selectAllFiltered() {
        if (selectedIds.size === filteredClients.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredClients.map(c => c.id)));
        }
    }

    async function sendCampaign() {
        setSending(true);
        setCampaignResult(null);
        try {
            const res = await fetch('/api/email/campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientIds: Array.from(selectedIds),
                    template: campaignTemplate,
                    subject: campaignSubject,
                    message: campaignMessage,
                    offerText: campaignOffer,
                }),
            });
            const data = await res.json();
            setCampaignResult({ sent: data.sent || 0, failed: data.failed || 0 });
        } catch {
            setCampaignResult({ sent: 0, failed: selectedIds.size });
        }
        setSending(false);
    }

    async function moveTier(tier: MembershipTier) {
        setMovingTier(true);
        await supabase.from('clients').update({ membership_status: tier }).in('id', Array.from(selectedIds));
        setShowTierMove(false);
        setSelectedIds(new Set());
        setMovingTier(false);
        fetchClients();
    }

    async function chargeClient() {
        if (!selected || !chargeData.amount) return;
        setCharging(true);
        setChargeResult(null);
        try {
            const res = await fetch('/api/stripe/client-charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: selected.id,
                    amount: parseFloat(chargeData.amount),
                    description: chargeData.description,
                    mode: chargeData.mode,
                }),
            });
            const data = await res.json();
            if (chargeData.mode === 'redirect' && data.url) {
                window.open(data.url, '_blank');
                setShowCharge(false);
            } else if (chargeData.mode === 'link') {
                setChargeResult(data.sent ? '✅ Payment link emailed to client' : '✅ Link created (no email on file)');
            }
        } catch {
            setChargeResult('❌ Failed to create charge');
        }
        setCharging(false);
    }

    const allSelected = filteredClients.length > 0 && selectedIds.size === filteredClients.length;

    return (
        <div className="space-y-6 entry-fade">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Clients</h1>
                    <p className="text-savron-silver text-sm uppercase tracking-wider mt-1">CRM · {filteredClients.length} clients</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {selectedIds.size > 0 && (
                        <>
                            <div className="relative">
                                <button
                                    onClick={() => setShowTierMove(v => !v)}
                                    className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest bg-white/5 text-savron-silver border border-white/10 rounded-savron hover:text-white hover:border-white/20 transition-all"
                                >
                                    Move {selectedIds.size} <ChevronDown className="w-3 h-3" />
                                </button>
                                <AnimatePresence>
                                    {showTierMove && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                            className="absolute right-0 top-full mt-1 bg-savron-grey border border-white/10 rounded-savron shadow-xl z-20 min-w-[160px] overflow-hidden"
                                        >
                                            {(['standard', 'inner_circle', 'vip'] as MembershipTier[]).map(tier => (
                                                <button
                                                    key={tier}
                                                    onClick={() => moveTier(tier)}
                                                    disabled={movingTier}
                                                    className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest text-savron-silver hover:text-white hover:bg-white/5 transition-colors"
                                                >
                                                    {tier.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <button
                                onClick={() => setShowCampaign(true)}
                                className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-savron hover:bg-blue-500/30 transition-all"
                            >
                                <Mail className="w-4 h-4" /> Email {selectedIds.size}
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all"
                    >
                        <Plus className="w-4 h-4" /> Add Client
                    </button>
                </div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-savron-silver/50" />
                    <input
                        type="text" placeholder="SEARCH CLIENTS..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        className="input-savron pl-12"
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {([
                        ['all', 'All'],
                        ['4_weeks', '4+ Wks'],
                        ['6_weeks', '6+ Wks'],
                        ['8_weeks', '8+ Wks'],
                        ['vip', 'VIP'],
                    ] as [VisitFilter, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => { setVisitFilter(key); setSelectedIds(new Set()); }}
                            className={cn(
                                "px-3 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                                visitFilter === key
                                    ? "bg-savron-green border border-savron-green-light/20 text-white"
                                    : "text-savron-silver border-white/10 hover:border-white/20 hover:text-white"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {fetchError && (
                <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-savron text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Failed to load clients: {fetchError}</span>
                </div>
            )}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                </div>
            ) : (
                <div className="card-savron overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="p-3 w-10">
                                    <input type="checkbox" checked={allSelected} onChange={selectAllFiltered} className="accent-savron-green w-3.5 h-3.5" />
                                </th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Name</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal hidden sm:table-cell">Email</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal hidden sm:table-cell">Phone</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Last Visit</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal hidden md:table-cell">Visits</th>
                                <th className="p-3 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Tier</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map(c => {
                                const visit = getLastVisitInfo(c);
                                return (
                                    <tr
                                        key={c.id}
                                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                        onClick={() => { setSelected(c); setEditData(c); setEditing(false); setChargeResult(null); }}
                                    >
                                        <td className="p-3" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="accent-savron-green w-3.5 h-3.5" />
                                        </td>
                                        <td className="p-3 text-white text-sm font-medium">
                                            <div>{c.name}</div>
                                            {c.email && (
                                                <div className="text-[10px] text-savron-silver/50 sm:hidden mt-0.5 max-w-[140px] truncate">
                                                    {c.email}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-savron-silver text-sm hidden sm:table-cell">{c.email || '—'}</td>
                                        <td className="p-3 text-savron-silver text-sm font-mono hidden sm:table-cell">{c.phone || '—'}</td>
                                        <td className={cn("p-3 text-sm", visit.color)}>{visit.text}</td>
                                        <td className="p-3 text-white text-sm font-mono hidden md:table-cell">{c.visit_count}</td>
                                        <td className="p-3"><StatusBadge status={c.membership_status} /></td>
                                        <td className="p-3" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setShowDelete(c.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-savron-silver/50 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredClients.length === 0 && (
                                <tr><td colSpan={7} className="p-10 text-center text-savron-silver/50 text-sm uppercase tracking-widest">No clients found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Client Detail / Edit Modal ── */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => { setSelected(null); setEditing(false); setShowCharge(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-white/5">
                                <div>
                                    <h2 className="text-white font-heading text-xl uppercase tracking-wider">{selected.name}</h2>
                                    <div className="mt-1"><StatusBadge status={selected.membership_status} /></div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setEditing(!editing)} className="text-savron-silver hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setSelected(null)} className="text-savron-silver hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {editing ? (
                                    <>
                                        <div className="space-y-3">
                                            <input value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} placeholder="FULL NAME" className="input-savron" />
                                            <input value={editData.email || ''} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} placeholder="EMAIL" className="input-savron" />
                                            <input value={editData.phone || ''} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} placeholder="PHONE" className="input-savron" />
                                            <textarea value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} placeholder="NOTES" className="input-savron min-h-[60px] resize-none" />
                                            <textarea value={editData.preferences || ''} onChange={e => setEditData(p => ({ ...p, preferences: e.target.value }))} placeholder="PREFERENCES" className="input-savron min-h-[60px] resize-none" />
                                            <select
                                                value={editData.membership_status || 'standard'}
                                                onChange={e => setEditData(p => ({ ...p, membership_status: e.target.value as Client['membership_status'] }))}
                                                className="input-savron"
                                            >
                                                <option value="standard">Standard</option>
                                                <option value="inner_circle">Inner Circle</option>
                                                <option value="vip">VIP</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-3 pt-2">
                                            <button onClick={() => setEditing(false)} className="px-4 py-2 text-xs uppercase tracking-widest text-savron-silver border border-white/10 rounded-savron hover:text-white transition-all">Cancel</button>
                                            <button onClick={saveEdit} className="px-4 py-2 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all flex items-center gap-2">
                                                <Check className="w-3 h-3" /> Save
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Email</span>
                                                <p className="text-white text-sm">{selected.email || '—'}</p>
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
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Last Visit</span>
                                                <p className={cn("text-sm", getLastVisitInfo(selected).color)}>
                                                    {getLastVisitInfo(selected).text}
                                                </p>
                                            </div>
                                        </div>
                                        {selected.notes && (
                                            <div className="space-y-1">
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Notes</span>
                                                <p className="text-white text-sm">{selected.notes}</p>
                                            </div>
                                        )}
                                        {selected.preferences && (
                                            <div className="space-y-1">
                                                <span className="text-savron-silver text-xs uppercase tracking-wider">Preferences</span>
                                                <p className="text-white text-sm">{selected.preferences}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {!editing && (
                                <>
                                    {/* Stripe Charge Panel */}
                                    <AnimatePresence>
                                        {showCharge && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-6 pb-4 pt-2 space-y-3 border-t border-white/5 bg-black/10">
                                                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 pt-2">Charge Details</p>
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-savron-silver text-sm">$</span>
                                                            <input
                                                                type="number" placeholder="0.00" step="0.01" min="1"
                                                                value={chargeData.amount}
                                                                onChange={e => setChargeData(p => ({ ...p, amount: e.target.value }))}
                                                                className="input-savron pl-7"
                                                            />
                                                        </div>
                                                        <input
                                                            placeholder="Description"
                                                            value={chargeData.description}
                                                            onChange={e => setChargeData(p => ({ ...p, description: e.target.value }))}
                                                            className="input-savron flex-[2]"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setChargeData(p => ({ ...p, mode: 'redirect' }))}
                                                            className={cn("flex-1 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                                                                chargeData.mode === 'redirect' ? "bg-savron-green border border-savron-green-light/20 text-white" : "text-savron-silver border-white/10 hover:border-white/20"
                                                            )}
                                                        >
                                                            <CreditCard className="w-3 h-3 inline mr-1" /> POS Checkout
                                                        </button>
                                                        <button
                                                            onClick={() => setChargeData(p => ({ ...p, mode: 'link' }))}
                                                            className={cn("flex-1 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                                                                chargeData.mode === 'link' ? "bg-savron-green border border-savron-green-light/20 text-white" : "text-savron-silver border-white/10 hover:border-white/20"
                                                            )}
                                                        >
                                                            <Mail className="w-3 h-3 inline mr-1" /> Email Link
                                                        </button>
                                                    </div>
                                                    {chargeResult && (
                                                        <p className="text-xs text-savron-silver text-center">{chargeResult}</p>
                                                    )}
                                                    <button
                                                        onClick={chargeClient}
                                                        disabled={charging || !chargeData.amount}
                                                        className="w-full py-2.5 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
                                                    >
                                                        {charging ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                                                            chargeData.mode === 'redirect' ? <><CreditCard className="w-3.5 h-3.5" /> Charge POS</> : <><DollarSign className="w-3.5 h-3.5" /> Send Pay Link</>
                                                        )}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="p-6 border-t border-white/5 flex justify-between gap-2 flex-wrap">
                                        <button
                                            onClick={() => setShowDelete(selected.id)}
                                            className="px-4 py-2 text-xs uppercase tracking-widest text-red-400 border border-red-500/20 rounded-savron hover:bg-red-500/10 transition-all flex items-center gap-2"
                                        >
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setShowCharge(v => !v); setChargeResult(null); }}
                                                className={cn(
                                                    "px-4 py-2 text-xs uppercase tracking-widest border rounded-savron transition-all flex items-center gap-2",
                                                    showCharge
                                                        ? "bg-savron-green border border-savron-green-light/20 text-white"
                                                        : "text-savron-silver border-white/10 hover:text-white hover:border-white/20"
                                                )}
                                            >
                                                <DollarSign className="w-3 h-3" /> Charge
                                            </button>
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="px-4 py-2 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all flex items-center gap-2"
                                            >
                                                <Edit3 className="w-3 h-3" /> Edit
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Delete Confirmation ── */}
            <AnimatePresence>
                {showDelete && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
                        onClick={() => setShowDelete(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-red-500/20 rounded-savron w-full max-w-sm p-6 text-center space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                            <h3 className="text-white font-heading text-lg uppercase tracking-wider">Delete Client?</h3>
                            <p className="text-savron-silver text-sm">This action cannot be undone.</p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setShowDelete(null)} className="px-4 py-2 text-xs uppercase tracking-widest text-savron-silver border border-white/10 rounded-savron hover:text-white transition-all">Cancel</button>
                                <button onClick={() => deleteClient(showDelete)} className="px-4 py-2 text-xs uppercase tracking-widest bg-red-500 text-white rounded-savron hover:bg-opacity-90 transition-all">Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Add Client Modal ── */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setShowAdd(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-lg shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-white/5">
                                <h2 className="text-white font-heading text-lg uppercase tracking-wider">New Client</h2>
                                <button onClick={() => setShowAdd(false)} className="text-savron-silver hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={addClient} className="p-6 space-y-4">
                                <input required placeholder="FULL NAME" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} className="input-savron" />
                                <input type="email" placeholder="EMAIL" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} className="input-savron" />
                                <input type="tel" placeholder="PHONE" value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} className="input-savron" />
                                <textarea placeholder="NOTES" value={newClient.notes} onChange={e => setNewClient(p => ({ ...p, notes: e.target.value }))} className="input-savron min-h-[80px] resize-none" />
                                <div className="flex justify-end pt-2">
                                    <button type="submit" className="px-6 py-3 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all">Add Client</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Campaign Composer Modal ── */}
            <AnimatePresence>
                {showCampaign && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => { setShowCampaign(false); setCampaignResult(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-white/5">
                                <div>
                                    <h2 className="text-white font-heading text-lg uppercase tracking-wider">Send Campaign</h2>
                                    <p className="text-savron-silver text-xs uppercase tracking-widest mt-1">{selectedIds.size} recipients</p>
                                </div>
                                <button onClick={() => { setShowCampaign(false); setCampaignResult(null); }} className="text-savron-silver hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Template</p>
                                    <div className="flex gap-2">
                                        {([
                                            ['miss_you', '💈 We Miss You'],
                                            ['special_offer', '💰 Special Offer'],
                                            ['custom', '✏️ Custom'],
                                        ] as [CampaignTemplate, string][]).map(([key, label]) => (
                                            <button
                                                key={key}
                                                onClick={() => setCampaignTemplate(key)}
                                                className={cn(
                                                    "px-3 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all flex-1",
                                                    campaignTemplate === key
                                                        ? "bg-savron-green border border-savron-green-light/20 text-white"
                                                        : "text-savron-silver border-white/10 hover:border-white/20"
                                                )}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {campaignTemplate === 'special_offer' && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Offer Text</p>
                                        <input value={campaignOffer} onChange={e => setCampaignOffer(e.target.value)} placeholder="15% OFF your next visit" className="input-savron" />
                                    </div>
                                )}

                                {campaignTemplate === 'custom' && (
                                    <>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Subject Line</p>
                                            <input value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} placeholder="Your subject line..." className="input-savron" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Message</p>
                                            <textarea value={campaignMessage} onChange={e => setCampaignMessage(e.target.value)} placeholder="Write your message here..." className="input-savron min-h-[120px] resize-none" />
                                        </div>
                                    </>
                                )}

                                {campaignResult && (
                                    <div className={cn("p-4 border rounded-savron text-sm", campaignResult.failed > 0 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300" : "border-savron-green/30 bg-savron-green/10 text-emerald-400")}>
                                        ✅ {campaignResult.sent} sent{campaignResult.failed > 0 ? ` · ❌ ${campaignResult.failed} failed` : ''}
                                    </div>
                                )}

                                <button
                                    onClick={sendCampaign}
                                    disabled={sending || (campaignTemplate === 'custom' && !campaignSubject)}
                                    className="w-full py-3 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Mail className="w-4 h-4" /> Send to {selectedIds.size} Clients</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
