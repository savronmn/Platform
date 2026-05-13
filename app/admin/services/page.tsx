"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Scissors, Clock, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOR_DOTS, AVAILABLE_COLORS } from '@/lib/services-data';

type DBService = {
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
    color: string | null;
    color_code: string | null;
    description: string | null;
    active: boolean;
    created_at: string;
};

const defaultForm = { name: '', durationMin: '45', priceStr: '', color: 'emerald', description: '' };

export default function AdminServicesPage() {
    const supabase = createClient();
    const [services, setServices] = useState<DBService[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(defaultForm);
    const [adding, setAdding] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<DBService | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('services').select('*').order('id');
            if (data) setServices(data);
            setLoading(false);
        }
        load();
    }, []);

    const addService = async () => {
        if (!form.name.trim() || !form.priceStr.trim() || !form.durationMin) return;
        setAdding(true);
        setAddError(null);
        const price_cents = Math.round(parseFloat(form.priceStr) * 100);
        const duration_min = parseInt(form.durationMin);
        const { data, error } = await supabase
            .from('services')
            .insert({
                name: form.name.trim(),
                duration_minutes: duration_min,
                price_cents,
                color: form.color,
                description: form.description.trim() || null,
            })
            .select()
            .single();
        if (error) {
            setAddError(error.message.includes('unique') ? 'A service with that name already exists.' : error.message);
        } else if (data) {
            setServices(prev => [...prev, data]);
            setForm(defaultForm);
            setShowAdd(false);
        }
        setAdding(false);
    };

    const deleteService = async (svc: DBService) => {
        setDeletingId(svc.id);
        await supabase.from('services').delete().eq('id', svc.id);
        setServices(prev => prev.filter(s => s.id !== svc.id));
        setDeletingId(null);
        setConfirmDelete(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Services</h1>
                    <p className="text-savron-silver text-sm mt-1">{services.length} service{services.length !== 1 ? 's' : ''} on the menu</p>
                </div>
                <button
                    onClick={() => { setShowAdd(v => !v); setAddError(null); setForm(defaultForm); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-savron-green/10 border border-savron-green/20 text-savron-green text-[10px] uppercase tracking-widest hover:bg-savron-green/20 transition-all rounded-savron"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Service
                </button>
            </div>

            {/* Add form */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="bg-savron-grey border border-savron-green/20 rounded-savron p-6 space-y-5"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-heading text-white uppercase tracking-wider text-sm">New Service</h3>
                            <button onClick={() => { setShowAdd(false); setForm(defaultForm); setAddError(null); }} className="text-savron-silver hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Service Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. The Signature Cut"
                                    className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Price (USD) *</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-savron-silver/50 text-sm">$</span>
                                    <input
                                        type="number"
                                        value={form.priceStr}
                                        onChange={e => setForm(f => ({ ...f, priceStr: e.target.value }))}
                                        placeholder="55"
                                        min="0"
                                        step="1"
                                        className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Duration (minutes) *</label>
                                <input
                                    type="number"
                                    value={form.durationMin}
                                    onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))}
                                    placeholder="45"
                                    min="5"
                                    step="5"
                                    className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Color</label>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {AVAILABLE_COLORS.map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, color: c }))}
                                            className={cn(
                                                "w-7 h-7 rounded-full transition-all",
                                                COLOR_DOTS[c] ?? 'bg-white/30',
                                                form.color === c
                                                    ? "ring-2 ring-offset-2 ring-offset-savron-grey ring-white/60 scale-110"
                                                    : "opacity-40 hover:opacity-80"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Description (shown on website)</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Brief service description for clients…"
                                rows={2}
                                className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron resize-none"
                            />
                        </div>

                        {addError && (
                            <p className="text-red-400 text-xs">{addError}</p>
                        )}

                        <button
                            onClick={addService}
                            disabled={adding || !form.name.trim() || !form.priceStr || !form.durationMin}
                            className="flex items-center gap-2 px-5 py-2.5 bg-savron-green text-black text-[11px] uppercase tracking-widest rounded-savron hover:bg-opacity-90 transition-all disabled:opacity-50"
                        >
                            {adding
                                ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                : <Plus className="w-3.5 h-3.5" />
                            }
                            {adding ? 'Adding…' : 'Add Service'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Services list */}
            {services.length === 0 ? (
                <div className="text-center py-20">
                    <Scissors className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                    <p className="text-savron-silver/30 text-sm uppercase tracking-widest">No services yet</p>
                    <p className="text-savron-silver/20 text-xs mt-1">Add your first service above</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {services.map(svc => (
                        <motion.div
                            key={svc.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            className="bg-savron-grey border border-white/5 rounded-savron px-5 py-4 flex items-center justify-between gap-4"
                        >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={cn("w-3 h-3 rounded-full shrink-0", COLOR_DOTS[svc.color ?? ''] ?? 'bg-white/30')} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium text-sm uppercase tracking-widest">{svc.name}</p>
                                    {svc.description && (
                                        <p className="text-savron-silver/40 text-[11px] mt-0.5 truncate">{svc.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-5 shrink-0">
                                <div className="text-right hidden sm:block">
                                    <p className="text-savron-silver font-mono text-sm flex items-center gap-1">
                                        <DollarSign className="w-3 h-3 opacity-50" />
                                        {Math.round(svc.price_cents / 100)}
                                    </p>
                                    <p className="text-savron-silver/40 text-[10px] flex items-center gap-1 justify-end">
                                        <Clock className="w-2.5 h-2.5" />
                                        {svc.duration_minutes} min
                                    </p>
                                </div>
                                <button
                                    onClick={() => setConfirmDelete(svc)}
                                    className="p-2 text-savron-silver/40 hover:text-red-400 hover:bg-red-500/5 border border-white/5 hover:border-red-500/20 rounded-savron transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Delete confirm modal */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setConfirmDelete(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-white/10 rounded-savron p-6 w-full max-w-sm shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <h3 className="font-heading text-white uppercase tracking-wider">Remove Service</h3>
                                <button onClick={() => setConfirmDelete(null)} className="text-savron-silver hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-savron-silver text-sm mb-6">
                                Remove <span className="text-white font-medium">{confirmDelete.name}</span> from the menu? Past bookings are unaffected.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => deleteService(confirmDelete)}
                                    disabled={deletingId === confirmDelete.id}
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 rounded-savron transition-all disabled:opacity-50"
                                >
                                    {deletingId === confirmDelete.id ? 'Removing…' : 'Remove'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
