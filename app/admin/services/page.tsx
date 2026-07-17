"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Scissors, Clock, DollarSign, GripVertical, Pencil, Check, Calendar, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESET_HEX_COLORS, resolveColor } from '@/lib/services-data';

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
    shop_calendar_id: string | null;
    google_booking_page_url: string | null;
    booking_page_slug: string | null;
};

type CalendarDraft = {
    shop_calendar_id: string;
    google_booking_page_url: string;
};

function slugifyServiceName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'service';
}

const defaultForm = { name: '', durationMin: '45', priceStr: '', color: '#34d399', description: '' };

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

function ColorPicker({
    value,
    onChange,
}: {
    value: string;
    onChange: (hex: string) => void;
}) {
    const isPreset = PRESET_HEX_COLORS.includes(value);
    const customInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                {PRESET_HEX_COLORS.map(hex => (
                    <button
                        key={hex}
                        type="button"
                        onClick={() => onChange(hex)}
                        style={{ backgroundColor: hex }}
                        className={cn(
                            "w-7 h-7 rounded-full transition-all duration-150",
                            value === hex
                                ? "ring-2 ring-white/50 ring-offset-2 ring-offset-savron-grey scale-110"
                                : "opacity-50 hover:opacity-90 hover:scale-105"
                        )}
                    />
                ))}

                {/* Custom color swatch */}
                <label
                    className={cn(
                        "relative w-7 h-7 rounded-full cursor-pointer transition-all duration-150 overflow-hidden flex items-center justify-center",
                        !isPreset
                            ? "ring-2 ring-white/50 ring-offset-2 ring-offset-savron-grey scale-110"
                            : "border border-dashed border-white/30 hover:border-white/60"
                    )}
                    style={!isPreset ? { backgroundColor: value } : {}}
                    title="Custom color"
                >
                    <input
                        ref={customInputRef}
                        type="color"
                        value={value.startsWith('#') ? value : '#34d399'}
                        onChange={e => onChange(e.target.value)}
                        className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
                    />
                    {isPreset && (
                        <Plus className="w-3 h-3 text-white/40" />
                    )}
                </label>
            </div>

            {/* Hex preview */}
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: value }} />
                <span className="text-[10px] font-mono text-savron-silver/50 uppercase">{value}</span>
            </div>
        </div>
    );
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

    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', durationMin: '', priceStr: '', color: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const dragIdx = useRef<number | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [calendarDrafts, setCalendarDrafts] = useState<Record<string, CalendarDraft>>({});
    const [calendarSavingId, setCalendarSavingId] = useState<string | null>(null);
    const [calendarError, setCalendarError] = useState<string | null>(null);
    const [calendarSavedId, setCalendarSavedId] = useState<string | null>(null);

    function initCalendarDrafts(list: DBService[]) {
        const drafts: Record<string, CalendarDraft> = {};
        for (const svc of list) {
            drafts[svc.id] = {
                shop_calendar_id: svc.shop_calendar_id ?? '',
                google_booking_page_url: svc.google_booking_page_url ?? '',
            };
        }
        setCalendarDrafts(drafts);
    }

    async function load() {
        setLoading(true);
        const data = await fetch('/api/services').then(r => r.json());
        if (Array.isArray(data)) {
            setServices(data);
            initCalendarDrafts(data);
        }
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
            color: resolveColor(svc.color),
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

    const saveCalendarConfig = async (svc: DBService) => {
        const draft = calendarDrafts[svc.id];
        if (!draft) return;
        setCalendarSavingId(svc.id);
        setCalendarError(null);
        setCalendarSavedId(null);
        try {
            const updated = await apiCall('PUT', {
                id: svc.id,
                shop_calendar_id: draft.shop_calendar_id.trim() || null,
                google_booking_page_url: draft.google_booking_page_url.trim() || null,
                booking_page_slug: svc.booking_page_slug ?? slugifyServiceName(svc.name),
            });
            setServices(prev => prev.map(s => s.id === svc.id ? updated : s));
            setCalendarDrafts(prev => ({
                ...prev,
                [svc.id]: {
                    shop_calendar_id: updated.shop_calendar_id ?? '',
                    google_booking_page_url: updated.google_booking_page_url ?? '',
                },
            }));
            setCalendarSavedId(svc.id);
            window.setTimeout(() => setCalendarSavedId(current => current === svc.id ? null : current), 2500);
        } catch (e: unknown) {
            setCalendarError(e instanceof Error ? e.message : 'Failed to save calendar settings');
        }
        setCalendarSavingId(null);
    };

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

    const inputCls = "w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron";

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-page">

            {/* Header */}
            <div className="admin-header">
                <div>
                    <p className="admin-kicker">Menu</p>
                    <h1 className="admin-title">Services</h1>
                    <p className="admin-subtitle">
                        {services.length} service{services.length !== 1 ? 's' : ''} · Drag to reorder
                    </p>
                </div>
                <button
                    onClick={() => { setShowAdd(v => !v); setAddError(null); setForm(defaultForm); }}
                    className="flex items-center gap-2 px-5 py-3 bg-savron-green text-white border border-savron-green-light/20 text-[10px] uppercase tracking-widest hover:bg-savron-green-light transition-all rounded-savron glow-blue"
                >
                    <Plus className="w-3.5 h-3.5" />
                    {showAdd ? 'Cancel' : 'Add Service'}
                </button>
            </div>

            {/* Shop Google Calendar booking pages */}
            {services.length > 0 && (
                <div className="card-savron space-y-5">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-savron bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 text-blue-300" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/50">Shop calendar</p>
                            <h2 className="font-heading text-white uppercase tracking-wider text-sm mt-0.5">
                                Google booking page per service
                            </h2>
                            <p className="text-savron-silver/60 text-xs mt-1 max-w-2xl leading-relaxed">
                                Paste each service&apos;s <strong className="text-savron-silver/80">Calendar ID</strong> from Google Calendar settings (savronmn@gmail.com).
                                The booking page URL is for your reference. Savron uses the calendar ID to send invites and read busy time.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {services.filter(s => s.active).map(svc => {
                            const draft = calendarDrafts[svc.id] ?? { shop_calendar_id: '', google_booking_page_url: '' };
                            const configured = Boolean(draft.shop_calendar_id.trim());
                            return (
                                <div key={`cal-${svc.id}`} className="border border-white/[0.06] rounded-savron p-4 space-y-3 bg-savron-black/30">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-white text-sm font-medium">{svc.name}</p>
                                            <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mt-0.5">
                                                {configured ? 'Calendar linked' : 'Not linked. using default shop calendar'}
                                            </p>
                                        </div>
                                        {draft.google_booking_page_url.trim() && (
                                            <a
                                                href={draft.google_booking_page_url.trim()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-savron-blue-light hover:text-white transition-colors"
                                            >
                                                <ExternalLink className="w-3 h-3" /> Open Google page
                                            </a>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-1.5">
                                                Google Calendar ID *
                                            </label>
                                            <input
                                                type="text"
                                                value={draft.shop_calendar_id}
                                                onChange={e => setCalendarDrafts(prev => ({
                                                    ...prev,
                                                    [svc.id]: { ...draft, shop_calendar_id: e.target.value },
                                                }))}
                                                placeholder="xxxx@group.calendar.google.com or email"
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-1.5">
                                                Google booking page URL
                                            </label>
                                            <input
                                                type="url"
                                                value={draft.google_booking_page_url}
                                                onChange={e => setCalendarDrafts(prev => ({
                                                    ...prev,
                                                    [svc.id]: { ...draft, google_booking_page_url: e.target.value },
                                                }))}
                                                placeholder="https://calendar.google.com/calendar/appointments/..."
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => saveCalendarConfig(svc)}
                                            disabled={calendarSavingId === svc.id}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-savron-green/90 text-white text-[11px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50"
                                        >
                                            {calendarSavingId === svc.id
                                                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                : <Check className="w-3.5 h-3.5" />
                                            }
                                            Save calendar
                                        </button>
                                        {calendarSavedId === svc.id && (
                                            <span className="text-[10px] uppercase tracking-widest text-savron-blue-light">Saved</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {calendarError && <p className="text-red-400 text-xs">{calendarError}</p>}
                </div>
            )}

            {/* Add form */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="card-savron space-y-6"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-heading text-white uppercase tracking-wider text-sm">New Service</h3>
                            <button onClick={() => { setShowAdd(false); setForm(defaultForm); setAddError(null); }} className="text-savron-silver hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. The Signature Cut"
                                    className={inputCls}
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
                                        placeholder="55" min="0" step="1"
                                        className={cn(inputCls, "pl-8")}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Duration (min) *</label>
                                <input
                                    type="number"
                                    value={form.durationMin}
                                    onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))}
                                    placeholder="45" min="5" step="5"
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-3">Color</label>
                            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2">Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Brief description for clients…"
                                rows={2}
                                className={cn(inputCls, "resize-none")}
                            />
                        </div>

                        {addError && <p className="text-red-400 text-xs">{addError}</p>}

                        <button
                            onClick={addService}
                            disabled={adding || !form.name.trim() || !form.priceStr || !form.durationMin}
                            className="flex items-center gap-2 px-5 py-2.5 bg-savron-green text-white border border-savron-green-light/20 text-[11px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50"
                        >
                            {adding
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Plus className="w-3.5 h-3.5" />
                            }
                            {adding ? 'Adding…' : 'Add Service'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Services list */}
            {services.length === 0 ? (
                <div className="card-savron text-center py-20">
                    <Scissors className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                    <p className="text-savron-silver/60 text-sm uppercase tracking-widest">No services yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {services.map((svc, idx) => {
                        const hex = resolveColor(svc.color);
                        const isEditing = editId === svc.id;
                        return (
                            <div
                                key={svc.id}
                                draggable={!isEditing}
                                onDragStart={() => onDragStart(idx, svc.id)}
                                onDragOver={e => onDragOver(e, idx)}
                                onDrop={onDrop}
                                onDragEnd={() => { setDraggingId(null); dragIdx.current = null; }}
                                className={cn(
                                    "flex card-savron p-0 overflow-hidden transition-all",
                                    draggingId === svc.id ? "opacity-50 scale-[0.99]" : ""
                                )}
                            >
                                {/* Color bar */}
                                <div className="w-1 shrink-0 transition-colors" style={{ backgroundColor: hex }} />

                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        /* ── Inline edit ── */
                                        <div className="px-5 py-5 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1.5">Name</label>
                                                    <input
                                                        value={editForm.name}
                                                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1.5">Price ($)</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.priceStr}
                                                        onChange={e => setEditForm(f => ({ ...f, priceStr: e.target.value }))}
                                                        min="0" step="1"
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1.5">Duration (min)</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.durationMin}
                                                        onChange={e => setEditForm(f => ({ ...f, durationMin: e.target.value }))}
                                                        min="5" step="5"
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div className="sm:col-span-1" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1.5">Description</label>
                                                <textarea
                                                    value={editForm.description}
                                                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                    rows={2}
                                                    className={cn(inputCls, "resize-none")}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1.5">Color</label>
                                                <ColorPicker value={editForm.color} onChange={c => setEditForm(f => ({ ...f, color: c }))} />
                                            </div>
                                            {editError && <p className="text-red-400 text-xs">{editError}</p>}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => saveEdit(svc.id)}
                                                    disabled={saving}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-savron-green/90 text-white text-[11px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50"
                                                >
                                                    {saving
                                                        ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        : <Check className="w-3.5 h-3.5" />
                                                    }
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditId(null)}
                                                    className="px-4 py-2 border border-white/10 text-savron-silver hover:text-white text-[11px] uppercase tracking-widest rounded-savron transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Read-only row ── */
                                        <div className="px-5 py-4 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <GripVertical className="w-4 h-4 text-savron-silver/20 shrink-0 cursor-grab active:cursor-grabbing" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-medium truncate">{svc.name}</p>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-savron-silver/50 text-[11px] flex items-center gap-1">
                                                            <DollarSign className="w-3 h-3" />{Math.round(svc.price_cents / 100)}
                                                        </span>
                                                        <span className="text-savron-silver/30 text-[10px]">·</span>
                                                        <span className="text-savron-silver/50 text-[11px] flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />{svc.duration_minutes} min
                                                        </span>
                                                        {svc.shop_calendar_id && (
                                                            <>
                                                                <span className="text-savron-silver/30 text-[10px]">·</span>
                                                                <span className="text-[10px] uppercase tracking-wider text-savron-blue-light/80">GCal linked</span>
                                                            </>
                                                        )}
                                                        {svc.description && (
                                                            <p className="text-savron-silver/40 text-[11px] truncate mt-1 sm:hidden">{svc.description}</p>
                                                        )}
                                                        {svc.description && (
                                                            <>
                                                                <span className="text-savron-silver/30 text-[10px] hidden sm:inline">·</span>
                                                                <span className="text-savron-silver/40 text-[11px] truncate hidden sm:inline">{svc.description}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => startEdit(svc)}
                                                    className="admin-icon-btn text-savron-silver/50 hover:text-white hover:bg-white/5 transition-all"
                                                    aria-label="Edit service"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(svc)}
                                                    className="admin-icon-btn text-savron-silver/50 hover:text-red-400 hover:bg-red-500/5 transition-all"
                                                    aria-label="Delete service"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Delete confirm */}
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
