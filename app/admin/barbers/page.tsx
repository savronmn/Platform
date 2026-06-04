"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scissors, Copy, Check, ToggleLeft, ToggleRight, UserCheck,
    Link as LinkIcon, Settings, X, Save, ShieldCheck, Calendar, Clock,
    Trash2, Camera, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { useServices } from '@/lib/use-services';

// ─── Schedule types ────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type DayKey = typeof DAYS[number];

interface DaySchedule {
    open: string;  // "09:00"
    close: string; // "19:00"
}
type WorkingHours = Partial<Record<DayKey, DaySchedule | null>>;

// Default shop hours
const DEFAULT_HOURS: DaySchedule = { open: '10:00', close: '19:00' };

// ─── Time options for dropdowns (30-min increments 7am–10pm) ──────────────────
const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

function formatTime12(t: string) {
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr);
    const m = mStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
}

export default function AdminBarbersPage() {
    const supabase = createClient();
    const services = useServices();
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
    const [copiedReg, setCopiedReg] = useState(false);

    // Settings panel
    const [settingsBarber, setSettingsBarber] = useState<Barber | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'services' | 'schedule'>('profile');
    const [licenseInput, setLicenseInput] = useState('');
    const [instagramInput, setInstagramInput] = useState('');
    const [servicesOffered, setServicesOffered] = useState<string[]>([]);
    const [workingHours, setWorkingHours] = useState<WorkingHours>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('barbers').select('*').order('created_at');
            if (data) setBarbers(data);
            setLoading(false);
        }
        load();
    }, []);

    const openSettings = (barber: Barber, tab: 'profile' | 'services' | 'schedule' = 'profile') => {
        setSettingsBarber(barber);
        setActiveTab(tab);
        setLicenseInput(barber.license_number ?? '');
        // Extract handle from full URL or bare handle
        const raw = barber.instagram_url ?? '';
        const handle = raw.includes('instagram.com/')
            ? raw.split('instagram.com/').pop()?.replace(/^@/, '') ?? ''
            : raw.replace(/^@/, '');
        setInstagramInput(handle);
        setServicesOffered(barber.services_offered ?? services.map(s => s.name));
        // Parse working_hours — default Mon–Sat open if not set
        const wh: WorkingHours = barber.working_hours as WorkingHours ?? {};
        const defaults: WorkingHours = {};
        for (const day of DAYS) {
            if (day === 'Sun') {
                defaults[day] = wh[day] !== undefined ? wh[day] : null; // Sun off by default
            } else {
                defaults[day] = wh[day] !== undefined ? wh[day] : { ...DEFAULT_HOURS };
            }
        }
        setWorkingHours(defaults);
        setSaved(false);
    };

    const closeSettings = () => { setSettingsBarber(null); setSaved(false); };

    const toggleService = (name: string) =>
        setServicesOffered(prev =>
            prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
        );

    const toggleDay = (day: DayKey) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: prev[day] ? null : { ...DEFAULT_HOURS },
        }));
        setSaved(false);
    };

    const setDayTime = (day: DayKey, field: 'open' | 'close', value: string) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...(prev[day] ?? DEFAULT_HOURS), [field]: value },
        }));
        setSaved(false);
    };

    const saveSettings = async () => {
        if (!settingsBarber) return;
        setSaving(true);
        const handle = instagramInput.trim().replace(/^@/, '');
        const update = {
            license_number: licenseInput.trim() || null,
            instagram_url: handle ? `https://www.instagram.com/${handle}` : null,
            services_offered: servicesOffered.length > 0 ? servicesOffered : null,
            working_hours: workingHours,
        };
        await supabase.from('barbers').update(update).eq('id', settingsBarber.id);
        setBarbers(prev => prev.map(b =>
            b.id === settingsBarber.id ? { ...b, ...update } : b
        ));
        setSettingsBarber(prev => prev ? { ...prev, ...update } : prev);
        setSaving(false);
        setSaved(true);
    };

    const toggleActive = async (barber: Barber) => {
        const newActive = !barber.active;
        await supabase.from('barbers').update({ active: newActive }).eq('id', barber.id);
        setBarbers(prev => prev.map(b => b.id === barber.id ? { ...b, active: newActive } : b));
    };

    const [confirmDelete, setConfirmDelete] = useState<Barber | null>(null);
    const deleteBarber = async (barber: Barber) => {
        await supabase.from('barbers').delete().eq('id', barber.id);
        setBarbers(prev => prev.filter(b => b.id !== barber.id));
        setConfirmDelete(null);
    };

    const approveBarber = async (barber: Barber) => {
        await supabase.from('barbers').update({ active: true }).eq('id', barber.id);
        setBarbers(prev => prev.map(b => b.id === barber.id ? { ...b, active: true } : b));
    };

    const copyBookingLink = (slug: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/book/${slug}`);
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    const copyRegistrationLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/join`);
        setCopiedReg(true);
        setTimeout(() => setCopiedReg(false), 2000);
    };

    const active  = barbers.filter(b => b.active);
    const pending = barbers.filter(b => !b.active);

    // Summary label for a barber's schedule
    const scheduleSummary = (barber: Barber): string => {
        const wh = barber.working_hours as WorkingHours | null;
        if (!wh) return 'No schedule set';
        const workDays = DAYS.filter(d => wh[d]);
        if (workDays.length === 0) return 'All days off';
        return workDays.join(', ');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Barbers</h1>
                    <p className="text-savron-silver text-sm mt-1">{active.length} active · {pending.length} pending approval</p>
                </div>
                <button
                    onClick={copyRegistrationLink}
                    className="flex items-center gap-2 px-4 py-2.5 border border-white/10 text-[10px] uppercase tracking-widest text-savron-silver hover:text-white hover:border-white/25 transition-all"
                >
                    {copiedReg ? <Check className="w-3 h-3 text-savron-green" /> : <LinkIcon className="w-3 h-3" />}
                    {copiedReg ? 'Link Copied!' : 'Copy Registration Link'}
                </button>
            </div>

            {/* Pending approvals */}
            {pending.length > 0 && (
                <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/70 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 inline-block" />
                        Pending Approval ({pending.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pending.map(barber => (
                            <div key={barber.id} className="bg-savron-grey border border-amber-500/15 rounded-savron p-5 space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 relative shrink-0">
                                        {barber.image_url && <Image src={barber.image_url} alt={barber.name} fill className="object-cover" />}
                                        {!barber.image_url && <Scissors className="w-4 h-4 text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-heading uppercase tracking-wider text-sm">{barber.name}</h3>
                                        {barber.email && <p className="text-savron-silver/50 text-xs truncate">{barber.email}</p>}
                                        {barber.phone && <p className="text-savron-silver/70 text-xs">{barber.phone}</p>}
                                    </div>
                                </div>
                                {barber.bio && (
                                    <p className="text-savron-silver/50 text-xs leading-relaxed line-clamp-2">{barber.bio}</p>
                                )}
                                {barber.specialties && barber.specialties.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {barber.specialties.map((s, i) => (
                                            <span key={i} className="text-[9px] uppercase tracking-wider text-savron-silver/60 bg-savron-charcoal px-2 py-0.5 border border-white/5">{s}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <button
                                         onClick={() => approveBarber(barber)}
                                         className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] uppercase tracking-widest bg-savron-green hover:bg-savron-green-light text-white border border-savron-green/50 hover:border-savron-green-light transition-all font-medium rounded-savron"
                                     >
                                        <UserCheck className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => openSettings(barber)}
                                        className="px-3 py-2.5 border border-white/20 text-white hover:bg-white/10 hover:border-white/40 rounded-savron transition-all"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active barbers */}
            <div>
                {pending.length > 0 && (
                    <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/70 mb-4">Active Team</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {active.map(barber => (
                        <div key={barber.id} className="bg-savron-grey border border-white/5 rounded-savron p-6 space-y-4">
                            <div className="flex items-start gap-4">
                                <button
                                    onClick={() => openSettings(barber, 'profile')}
                                    className="relative w-16 h-16 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 shrink-0 group"
                                    title="Edit profile photo"
                                >
                                    {barber.image_url
                                        ? <Image src={barber.image_url} alt={barber.name} fill className="object-cover" />
                                        : <Scissors className="w-5 h-5 text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    }
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="w-4 h-4 text-white" />
                                    </div>
                                </button>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-heading uppercase tracking-wider">{barber.name}</h3>
                                    <p className="text-emerald-400 text-xs uppercase tracking-widest">{barber.role}</p>
                                    {barber.email && <p className="text-savron-silver/50 text-xs mt-1 truncate">{barber.email}</p>}
                                    {barber.license_number && (
                                        <p className="text-savron-silver/70 text-[10px] mt-0.5 flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> {barber.license_number}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Schedule summary */}
                            <div className="flex items-center gap-2 text-[10px] text-savron-silver/50">
                                <Calendar className="w-3 h-3 shrink-0" />
                                <span>{scheduleSummary(barber)}</span>
                            </div>

                            {barber.services_offered && barber.services_offered.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {barber.services_offered.map((s, i) => (
                                        <span key={i} className="text-[10px] uppercase tracking-wider text-savron-silver bg-savron-charcoal px-2 py-1 border border-white/5 rounded-savron">{s}</span>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-white/5 gap-3">
                                <button
                                    onClick={() => toggleActive(barber)}
                                    className="flex items-center gap-2 text-xs uppercase tracking-wider transition-all text-emerald-400 hover:text-emerald-300 font-medium"
                                >
                                    <ToggleRight className="w-4 h-4" /> Active
                                </button>
                                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                                    <button
                                        onClick={() => copyBookingLink(barber.slug)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 rounded-savron transition-all"
                                    >
                                        {copiedSlug === barber.slug ? <Check className="w-3 h-3 text-savron-green" /> : <Copy className="w-3 h-3" />}
                                        {copiedSlug === barber.slug ? 'Copied' : 'Link'}
                                    </button>
                                    <a
                                        href={`/admin/barbers/${barber.id}/calendar`}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 rounded-savron transition-all"
                                    >
                                        <Calendar className="w-3.5 h-3.5" /> Calendar
                                    </a>
                                    <button
                                        onClick={() => openSettings(barber)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 rounded-savron transition-all"
                                    >
                                        <Settings className="w-3.5 h-3.5" /> Settings
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(barber)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs uppercase tracking-wider text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-savron transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Archive
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {active.length === 0 && (
                        <p className="text-savron-silver/60 text-sm col-span-3">No active barbers yet.</p>
                    )}
                </div>
            </div>
        </motion.div>

        {/* Delete confirmation modal */}
        <AnimatePresence>
            {confirmDelete && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setConfirmDelete(null)}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                        className="bg-savron-grey border border-red-500/20 rounded-savron p-6 max-w-sm w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="font-heading text-lg text-white uppercase tracking-wider mb-2">Archive Barber?</h3>
                        <p className="text-savron-silver/70 text-sm mb-6">
                            Remove <span className="text-white font-medium">{confirmDelete.name}</span> from your team. This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 py-2.5 text-[11px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteBarber(confirmDelete)}
                                className="flex-1 py-2.5 text-[11px] uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white rounded-savron transition-all font-medium"
                            >
                                Archive
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Settings slide-out panel */}
        <AnimatePresence>
            {settingsBarber && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                        onClick={closeSettings}
                    />
                    <motion.aside
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.22 }}
                        className="fixed top-0 right-0 h-full w-full max-w-md bg-savron-grey border-l border-white/10 z-50 flex flex-col overflow-hidden shadow-2xl"
                    >
                        {/* Panel header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 relative shrink-0">
                                    {settingsBarber.image_url
                                        ? <Image src={settingsBarber.image_url} alt={settingsBarber.name} fill className="object-cover" />
                                        : <User className="w-4 h-4 text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    }
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/50 mb-0.5">Barber Settings</p>
                                    <h2 className="font-heading text-lg text-white uppercase tracking-wider">{settingsBarber.name}</h2>
                                </div>
                            </div>
                            <button onClick={closeSettings} className="text-savron-silver hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-white/5 shrink-0">
                            {([
                                { key: 'profile',  label: 'Profile'   },
                                { key: 'services', label: 'Services'  },
                                { key: 'schedule', label: 'Schedule'  },
                            ] as const).map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    className={cn(
                                        "flex-1 py-3 text-[10px] uppercase tracking-widest transition-colors",
                                        activeTab === key
                                            ? "text-white border-b-2 border-savron-green-light"
                                            : "text-savron-silver/50 hover:text-savron-silver"
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* ── PROFILE TAB ──────────────────────────────────── */}
                            {activeTab === 'profile' && (
                                <>
                                    {/* Photo */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-4">
                                            Profile Photo
                                        </label>
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="relative w-24 h-24">
                                                <div className="w-24 h-24 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 relative">
                                                    {settingsBarber.image_url
                                                        ? <Image src={settingsBarber.image_url} alt={settingsBarber.name} fill className="object-cover" />
                                                        : <User className="w-8 h-8 text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                                    }
                                                </div>
                                                <label
                                                    htmlFor="photo-upload"
                                                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-savron-green border border-savron-grey flex items-center justify-center cursor-pointer hover:bg-savron-green-light transition-colors"
                                                >
                                                    <Camera className="w-3.5 h-3.5 text-white" />
                                                </label>
                                            </div>
                                            <input
                                                type="file"
                                                id="photo-upload"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.currentTarget.files?.[0];
                                                    if (!file) return;
                                                    try {
                                                        const ext = file.name.split('.').pop();
                                                        const path = `barber-photos/${settingsBarber.id}.${ext}`;
                                                        const { error: upErr } = await supabase.storage
                                                            .from('barbers')
                                                            .upload(path, file, { upsert: true, contentType: file.type });
                                                        if (upErr) throw upErr;
                                                        const { data: { publicUrl } } = supabase.storage.from('barbers').getPublicUrl(path);
                                                        await supabase.from('barbers').update({ image_url: publicUrl }).eq('id', settingsBarber.id);
                                                        setSettingsBarber(prev => prev ? { ...prev, image_url: publicUrl } : prev);
                                                        setBarbers(prev => prev.map(b => b.id === settingsBarber.id ? { ...b, image_url: publicUrl } : b));
                                                    } catch (err) {
                                                        console.error('Photo upload failed:', err);
                                                    }
                                                }}
                                            />
                                            <label htmlFor="photo-upload" className="px-6 py-2.5 text-[11px] uppercase tracking-widest bg-savron-green/10 text-savron-green border border-savron-green/30 hover:bg-savron-green/20 rounded-savron cursor-pointer transition-all font-medium">
                                                {settingsBarber.image_url ? 'Change Photo' : 'Upload Photo'}
                                            </label>
                                        </div>
                                    </div>

                                    {/* License number */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-3">
                                            Professional License
                                        </label>
                                        <input
                                            type="text"
                                            value={licenseInput}
                                            onChange={e => setLicenseInput(e.target.value)}
                                            placeholder="License number (e.g. MN-12345)"
                                            className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron"
                                        />
                                    </div>

                                    {/* Instagram handle */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-3">
                                            Instagram
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-savron-silver/40 text-sm select-none">@</span>
                                            <input
                                                type="text"
                                                value={instagramInput}
                                                onChange={e => { setInstagramInput(e.target.value.replace(/^@/, '')); setSaved(false); }}
                                                placeholder="handle"
                                                className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron"
                                            />
                                        </div>
                                    </div>

                                    {/* Contact info (read-only) */}
                                    {(settingsBarber.email || settingsBarber.phone) && (
                                        <div className="space-y-2">
                                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50">Contact</label>
                                            {settingsBarber.email && (
                                                <p className="text-savron-silver/70 text-sm">{settingsBarber.email}</p>
                                            )}
                                            {settingsBarber.phone && (
                                                <p className="text-savron-silver/70 text-sm">{settingsBarber.phone}</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── SERVICES TAB ─────────────────────────────────── */}
                            {activeTab === 'services' && (
                                <div>
                                    <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-1">
                                        Services Offered
                                    </label>
                                    <p className="text-savron-silver/70 text-xs mb-4">Only toggled services appear on this barber&apos;s booking page.</p>
                                    <div className="space-y-2">
                                        {services.map(svc => {
                                            const on = servicesOffered.includes(svc.name);
                                            return (
                                                <button
                                                    key={svc.id}
                                                    type="button"
                                                    onClick={() => toggleService(svc.name)}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-4 py-3 border rounded-savron transition-all text-left",
                                                        on
                                                            ? "bg-savron-green/10 border-savron-green/30 text-white"
                                                            : "bg-savron-charcoal border-white/5 text-savron-silver/50"
                                                    )}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium">{svc.name}</p>
                                                        <p className="text-[10px] opacity-50 mt-0.5">{svc.duration} · {svc.price}</p>
                                                    </div>
                                                    {on
                                                        ? <ToggleRight className="w-5 h-5 text-savron-green shrink-0" />
                                                        : <ToggleLeft  className="w-5 h-5 shrink-0" />
                                                    }
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── SCHEDULE TAB ─────────────────────────────────── */}
                            {activeTab === 'schedule' && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-1">Working Hours</p>
                                    <p className="text-savron-silver/70 text-xs mb-6">
                                        Set this barber&apos;s available days and hours. Clients can only book within these windows. Google Calendar events during these hours will block slots automatically.
                                    </p>
                                    <div className="space-y-3">
                                        {DAYS.map(day => {
                                            const schedule = workingHours[day];
                                            const isOn = !!schedule;
                                            return (
                                                <div
                                                    key={day}
                                                    className={cn(
                                                        "border rounded-savron p-4 transition-all",
                                                        isOn ? "border-white/10 bg-savron-charcoal/60" : "border-white/5 bg-savron-charcoal/20 opacity-60"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-sm font-heading uppercase tracking-wider text-white">{day}</span>
                                                        <button
                                                            onClick={() => toggleDay(day)}
                                                            className="flex items-center gap-1.5 text-xs transition-colors"
                                                        >
                                                            {isOn
                                                                ? <><ToggleRight className="w-5 h-5 text-emerald-400" /><span className="text-emerald-400 uppercase tracking-widest text-[10px]">Open</span></>
                                                                : <><ToggleLeft className="w-5 h-5 text-savron-silver/30" /><span className="text-savron-silver/30 uppercase tracking-widest text-[10px]">Off</span></>
                                                            }
                                                        </button>
                                                    </div>

                                                    {isOn && (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1">
                                                                <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1.5">Open</p>
                                                                <select
                                                                    value={schedule!.open}
                                                                    onChange={e => setDayTime(day, 'open', e.target.value)}
                                                                    className="w-full bg-savron-grey border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-savron-green/50 rounded-savron appearance-none cursor-pointer"
                                                                >
                                                                    {TIME_OPTIONS.map(t => (
                                                                        <option key={t} value={t}>{formatTime12(t)}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <Clock className="w-4 h-4 text-savron-silver/30 shrink-0 mt-5" />
                                                            <div className="flex-1">
                                                                <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1.5">Close</p>
                                                                <select
                                                                    value={schedule!.close}
                                                                    onChange={e => setDayTime(day, 'close', e.target.value)}
                                                                    className="w-full bg-savron-grey border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-savron-green/50 rounded-savron appearance-none cursor-pointer"
                                                                >
                                                                    {TIME_OPTIONS.filter(t => t > schedule!.open).map(t => (
                                                                        <option key={t} value={t}>{formatTime12(t)}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Save footer */}
                        <div className="p-6 border-t border-white/5 shrink-0">
                            <button
                                onClick={saveSettings}
                                disabled={saving}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest font-medium rounded-savron transition-all disabled:opacity-50",
                                    saved
                                        ? "bg-savron-green/20 text-emerald-400 border border-savron-green/35"
                                        : "bg-savron-green text-white border border-savron-green-light/20 hover:bg-savron-green-light"
                                )}
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : saved ? (
                                    <><Check className="w-4 h-4" /> Saved</>
                                ) : (
                                    <><Save className="w-4 h-4" /> Save Settings</>
                                )}
                            </button>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
        </>
    );
}
