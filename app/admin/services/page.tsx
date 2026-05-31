"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Scissors, Clock, DollarSign, GripVertical, Pencil, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOR_DOTS, AVAILABLE_COLORS } from '@/lib/services-data';

type DBService = {
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
    color: string | null;
    description: string | null;
    active: boolean;
    sort_order: number | null;
    created_at: string;
};

const defaultForm = { name: '', durationMin: '45', priceStr: '', color: 'emerald', description: '' };

async function apiCall(method: string, body: object) {
    const res = await fetch('/api/services', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Request failed');
    return json;
}

export default function AdminServicesPage() {
    const [services, setServices] = useState<DBService[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(defaultForm);
    const [adding, setAdding] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<DBService | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);

    // Inline edit
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', durationMin: '', priceStr: '', color: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Drag-to-reorder
    const dragIdx = useRef<number | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        const data = await fetch('/api/services').then(r => r.json());
        if (Array.isArray(data)) setServices(data);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    const addService = async () => {
        if (!form.name.trim() || !form.priceStr.trim() || !form.durationMin) return;
        setAdding(true);
        setAddError(null);
        try {
            const created = await apiCall('POST', {
                name: form.name.trim(),
                duration_minutes: parseInt(form.durationMin),
                price_cents: Math.round(parseFloat(form.priceStr) * 100),
                color: form.color,
                description: form.description.trim() || null,
            });
            setServices(prev => [...prev, created]);
            setForm(defaultForm);
            setShowAdd(false);
        } catch (e: any) {
            setAddError(e.message.includes('unique') ? 'A service with that name already exists.' : e.message);
        }
        setAdding(false);
    };

    const deleteService = async (svc: DBService) => {
        setDeletingId(svc.id);
        try {
            await apiCall('DELETE', { id: svc.id });
            setServices(prev => prev.filter(s => s.id !== svc.id));
        } catch {}
        setDeletingId(null);
        setConfirmDelete(null);
    };

    const startEdit = (svc: DBService) => {
        setEditId(svc.id);
        setEditError(null);
        setEditForm({
            name: svc.name,
            durationMin: String(svc.duration_minutes),
            priceStr: String(Math.round(svc.price_cents / 100)),
            color: svc.color ?? 'emerald',
            description: svc.description ?? '',
        });
    };

    const saveEdit = async (id: string) => {
        setSaving(true);
        setEditError(null);
        try {
            const updated = await apiCall('PUT', {
                id,
                name: editForm.name.trim(),
                duration_minutes: parseInt(editForm.durationMin),
                price_cents: Math.round(parseFloat(editForm.priceStr) * 100),
                color: editForm.color,
                description: editForm.description.trim() || null,
            });
            setServices(prev => prev.map(s => s.id === id ? updated : s));
            setEditId(null);
        } catch (e: any) {
            setEditError(e.message);
        }
        setSaving(false);
    };

    // Drag-to-reorder handlers
    const onDragStart = (idx: number, id: string) => {
        dragIdx.current = idx;
        setDraggingId(id);
    };
    const onDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (dragIdx.current === null || dragIdx.current === idx) return;
        const reordered = [...services];
        const [moved] = reordered.splice(dragIdx.current, 1);
        reordered.splice(idx, 0, moved);
        dragIdx.current = idx;
        setServices(reordered);
    };
    const onDrop = async () => {
        setDraggingId(null);
        dragIdx.current = null;
        // Persist new order
        await fetch('/api/services', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: services.map(s => s.id) }),
        });
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
                    <p className="text-savron-silver text-sm mt-1">
                        {services.length} service{services.length !== 1 ? 's' : ''} · Drag rows to reorder
                    </p>
                </div>
                <button
                    onClick={() => { setShowAdd(v => !v); setAddError(null); setForm(defaultForm); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-savron-green text-white border border-savron-green-light/20 text-[10px] uppercase tracking-widest hover:bg-savron-green-light transition-all rounded-savron"
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
                                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. The Signature Cut"
                                    className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Price (USD) *</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-savron-silver/50 text-sm">$</span>
                                    <input type="number" value={form.priceStr} onChange={e => setForm(f => ({ ...f, priceStr: e.target.value }))}
                                        placeholder="55" min="0" step="1"
                                        className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Duration (minutes) *</label>
                                <input type="number" value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))}
                                    placeholder="45" min="5" step="5"
                                    className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Color</label>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {AVAILABLE_COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                                            className={cn("w-7 h-7 rounded-full transition-all", COLOR_DOTS[c] ?? 'bg-white/30',
                                                form.color === c ? "ring-2 ring-offset-2 ring-offset-savron-grey ring-white/60 scale-110" : "opacity-40 hover:opacity-80"
                                            )} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Description</label>
                            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Brief service description for clients…" rows={2}
                                className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron resize-none" />
                        </div>

                        {addError && <p className="text-red-400 text-xs">{addError}</p>}

                        <button onClick={addService} disabled={adding || !form.name.trim() || !form.priceStr || !form.durationMin}
                            className="flex items-center gap-2 px-5 py-2.5 bg-savron-green text-white border border-savron-green-light/20 text-[11px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50">
                            {adding ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            {adding ? 'Adding…' : 'Add Service'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Services list */}
            {services.length === 0 ? (
                <div className="text-center py-20">
                    <Scissors className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                    <p className="text-savron-silver/60 text-sm uppercase tracking-widest">No services yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {services.map((svc, idx) => {
                        const isEditing = editId === svc.id;
                        return (
                            <div
                                key={svc.id}
                                draggable
                                onDragStart={() => onDragStart(idx, svc.id)}
                                onDragOver={e => onDragOver(e, idx)}
                                onDrop={onDrop}
                                onDragEnd={() => { setDraggingId(null); dragIdx.current = null; }}
                                className={cn(
                                    "bg-savron-grey border rounded-savron transition-all",
                                    draggingId === svc.id ? "border-savron-green/40 opacity-60 scale-[0.99]" : "border-white/5"
                                )}
                            >
                                {isEditing ? (
                                    /* ── Inline edit row ── */
                                    <div className="px-5 py-4 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="sm:col-span-3">
                                                <label className="block text-[10px] uppercase tracking-widest text-savron-silver/70 mb-1">Name</label>
                                                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                    className="w-full bg-savron-charcoal border border-white/10 text-white px-3 py-2 text-sm rounded-savron focus:outline-none focus:border-savron-green/50" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest text-savron-silver/70 mb-1">Price ($)</label>
                                                <input type="number" value={editForm.priceStr} onChange={e => setEditForm(f => ({ ...f, priceStr: e.target.value }))}
                                                    min="0" step="1"
                                                    className="w-full bg-savron-charcoal border border-white/10 text-white px-3 py-2 text-sm rounded-savron focus:outline-none focus:border-savron-green/50" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest text-savron-silver/70 mb-1">Duration (min)</label>
                                                <input type="number" value={editForm.durationMin} onChange={e => setEditForm(f => ({ ...f, durationMin: e.target.value }))}
                                                    min="5" step="5"
                                                    className="w-full bg-savron-charcoal border border-white/10 text-white px-3 py-2 text-sm rounded-savron focus:outline-none focus:border-savron-green/50" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest text-savron-silver/70 mb-1">Color</label>
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {AVAILABLE_COLORS.map(c => (
                                                        <button key={c} type="button" onClick={() => setEditForm(f => ({ ...f, color: c }))}
                                                            className={cn("w-6 h-6 rounded-full transition-all", COLOR_DOTS[c] ?? 'bg-white/30',
                                                                editForm.color === c ? "ring-2 ring-offset-1 ring-offset-savron-grey ring-white/60 scale-110" : "opacity-40 hover:opacity-80"
                                                            )} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-widest text-savron-silver/70 mb-1">Description</label>
                                            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                rows={2} className="w-full bg-savron-charcoal border border-white/10 text-white px-3 py-2 text-sm rounded-savron focus:outline-none focus:border-savron-green/50 resize-none" />
                                        </div>
                                        {editError && <p className="text-red-400 text-xs">{editError}</p>}
                                        <div className="flex gap-2">
                                            <button onClick={() => saveEdit(svc.id)} disabled={saving}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-savron-green/90 text-white text-[11px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50">
                                                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                Save
                                            </button>
                                            <button onClick={() => setEditId(null)}
                                                className="px-4 py-2 border border-white/10 text-savron-silver hover:text-white text-[11px] uppercase tracking-widest rounded-savron transition-all">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── Read-only row ── */
                                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {/* Drag handle */}
                                            <GripVertical className="w-4 h-4 text-savron-silver/25 shrink-0 cursor-grab active:cursor-grabbing" />
                                            <div className={cn("w-3 h-3 rounded-full shrink-0", COLOR_DOTS[svc.color ?? ''] ?? 'bg-white/30')} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium text-sm uppercase tracking-widest">{svc.name}</p>
                                                <p className="text-savron-silver/70 text-[11px] mt-0.5 sm:hidden">
                                                    ${Math.round(svc.price_cents / 100)} · {svc.duration_minutes} min
                                                </p>
                                                {svc.description && (
                                                    <p className="text-savron-silver/70 text-[11px] mt-0.5 truncate">{svc.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-savron-silver font-mono text-sm flex items-center gap-1">
                                                    <DollarSign className="w-3 h-3 opacity-50" />
                                                    {Math.round(svc.price_cents / 100)}
                                                </p>
                                                <p className="text-savron-silver/70 text-[10px] flex items-center gap-1 justify-end">
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {svc.duration_minutes} min
                                                </p>
                                            </div>
                                            <button onClick={() => startEdit(svc)}
                                                className="p-2 text-savron-silver/70 hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/20 rounded-savron transition-all">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setConfirmDelete(svc)}
                                                className="p-2 text-savron-silver/70 hover:text-red-400 hover:bg-red-500/5 border border-white/5 hover:border-red-500/20 rounded-savron transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
                                <button onClick={() => setConfirmDelete(null)}
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all">
                                    Cancel
                                </button>
                                <button onClick={() => deleteService(confirmDelete)} disabled={deletingId === confirmDelete.id}
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 rounded-savron transition-all disabled:opacity-50">
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
