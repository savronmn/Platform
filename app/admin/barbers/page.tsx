"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Copy, Check, ToggleLeft, ToggleRight, UserCheck,
    Link as LinkIcon, Settings, X, Save, ShieldCheck, Calendar, Clock,
    Trash2, Camera, User, ExternalLink, Users, UserPlus, Mail, Phone,
    Layers, Scissors, Upload, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import type { Barber } from '@/lib/types';
import { useServices } from '@/lib/use-services';
import {
    adminBarberPortalUrl,
    barberBookingPageUrl,
    barberPortalLoginUrl,
} from '@/lib/barber-portal-urls';
import BarberApplicationsPanel from '@/components/admin/BarberApplicationsPanel';

// ─── Schedule types ────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type DayKey = typeof DAYS[number];

interface DaySchedule {
    open: string;  // "09:00"
    close: string; // "19:00"
}
type WorkingHours = Partial<Record<DayKey, DaySchedule | null>>;

// Default shop hours (Google Business listing)
const DEFAULT_WEEKDAY: DaySchedule = { open: '10:00', close: '19:00' };
const DEFAULT_HOURS: WorkingHours = {
    Mon: DEFAULT_WEEKDAY,
    Tue: DEFAULT_WEEKDAY,
    Wed: DEFAULT_WEEKDAY,
    Thu: DEFAULT_WEEKDAY,
    Fri: DEFAULT_WEEKDAY,
    Sat: { open: '09:00', close: '16:30' },
    Sun: { open: '09:00', close: '14:00' },
};

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

const SETTINGS_TABS = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'services', label: 'Services', icon: Layers },
    { key: 'schedule', label: 'Schedule', icon: Clock },
    { key: 'links', label: 'Links', icon: LinkIcon },
] as const;

type SettingsTab = typeof SETTINGS_TABS[number]['key'];

type BarberServiceEdit = {
    serviceUuid: string;
    name: string;
    enabled: boolean;
    priceCents: number;
    durationMinutes: number;
    defaultPriceCents: number;
    defaultDurationMinutes: number;
};

function actionBtnClass(variant: 'default' | 'primary' | 'calendar' | 'danger' = 'default') {
    const base = 'admin-action-btn w-full rounded-savron transition-all font-medium';
    switch (variant) {
        case 'primary':
            return cn(base, 'bg-savron-green/15 hover:bg-savron-green/25 border border-savron-green/30 text-accent-blue hover:text-savron-cream');
        case 'calendar':
            return cn(base, 'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-300 hover:text-blue-200');
        case 'danger':
            return cn(base, 'text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30');
        default:
            return cn(base, 'text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20');
    }
}

interface BarberCardActionsProps {
    barber: Barber;
    copiedPortalSlug: string | null;
    copiedSlug: string | null;
    onCopyPortalLink: (slug: string) => void;
    onCopyBookingLink: (slug: string) => void;
    onOpenSettings: (barber: Barber) => void;
    onArchive: (barber: Barber) => void;
}

function BarberCardActions({
    barber,
    copiedPortalSlug,
    copiedSlug,
    onCopyPortalLink,
    onCopyBookingLink,
    onOpenSettings,
    onArchive,
}: BarberCardActionsProps) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <Link
                    href={`/admin/barbers/${barber.id}/calendar`}
                    className={actionBtnClass('calendar')}
                    title="Open barber calendar overview"
                >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Calendar</span>
                </Link>
                <button
                    type="button"
                    onClick={() => onOpenSettings(barber)}
                    className={actionBtnClass('primary')}
                    title="Barber settings"
                >
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    <span>Settings</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => onCopyPortalLink(barber.slug)}
                    className={actionBtnClass()}
                    title="Copy portal login link"
                >
                    {copiedPortalSlug === barber.slug
                        ? <Check className="w-3.5 h-3.5 text-savron-green shrink-0" />
                        : <LinkIcon className="w-3.5 h-3.5 shrink-0" />}
                    <span>{copiedPortalSlug === barber.slug ? 'Copied!' : 'Copy Login'}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onCopyBookingLink(barber.slug)}
                    className={actionBtnClass()}
                    title="Copy client booking link"
                >
                    {copiedSlug === barber.slug
                        ? <Check className="w-3.5 h-3.5 text-savron-green shrink-0" />
                        : <Copy className="w-3.5 h-3.5 shrink-0" />}
                    <span>{copiedSlug === barber.slug ? 'Copied!' : 'Copy Booking'}</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Link
                    href={adminBarberPortalUrl(barber.id, barber.slug)}
                    className={actionBtnClass()}
                    title="Open barber portal (admin can edit)"
                >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span>Open Portal</span>
                </Link>
                <button
                    type="button"
                    onClick={() => onArchive(barber)}
                    className={actionBtnClass('danger')}
                    title="Archive barber"
                >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Archive</span>
                </button>
            </div>
        </div>
    );
}

export default function AdminBarbersPage() {
    const supabase = createClient();
    const services = useServices();
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
    const [copiedPortalSlug, setCopiedPortalSlug] = useState<string | null>(null);
    const [copiedReg, setCopiedReg] = useState(false);

    // Settings panel
    const [settingsBarber, setSettingsBarber] = useState<Barber | null>(null);
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
    const [licenseInput, setLicenseInput] = useState('');
    const [instagramInput, setInstagramInput] = useState('');
    const [servicesOffered, setServicesOffered] = useState<string[]>([]);
    const [serviceEdits, setServiceEdits] = useState<BarberServiceEdit[]>([]);
    const [workingHours, setWorkingHours] = useState<WorkingHours>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('barbers').select('*').order('created_at');
            if (data) setBarbers(data);
            setLoading(false);
        }
        load();
    }, []);

    useEffect(() => {
        if (!settingsBarber) return;
        document.documentElement.classList.add('lenis-stopped');
        return () => {
            document.documentElement.classList.remove('lenis-stopped');
        };
    }, [settingsBarber]);

    const buildServiceEdits = async (barber: Barber) => {
        const [{ data: catalog }, { data: barberRows }] = await Promise.all([
            supabase
                .from('services')
                .select('id, name, price_cents, duration_minutes, sort_order')
                .eq('active', true)
                .order('sort_order', { ascending: true, nullsFirst: false })
                .order('created_at'),
            supabase
                .from('barber_service')
                .select('service_id, price_cents, duration_minutes')
                .eq('barber_id', barber.id),
        ]);

        const menu = catalog?.length
            ? catalog
            : services.map((s) => ({
                id: s.serviceUuid ?? String(s.id),
                name: s.name,
                price_cents: s.priceCents,
                duration_minutes: s.durationMin,
            }));

        const rowByServiceId = new Map(
            (barberRows ?? []).map((row) => [row.service_id as string, row]),
        );

        return menu.map((svc) => {
            const existing = rowByServiceId.get(svc.id);
            const enabled = existing
                ? true
                : (barber.services_offered ?? menu.map((s) => s.name)).includes(svc.name);

            return {
                serviceUuid: svc.id,
                name: svc.name,
                enabled,
                priceCents: existing?.price_cents ?? svc.price_cents,
                durationMinutes: existing?.duration_minutes ?? svc.duration_minutes,
                defaultPriceCents: svc.price_cents,
                defaultDurationMinutes: svc.duration_minutes,
            };
        });
    };

    const openSettings = async (barber: Barber, tab: SettingsTab = 'profile') => {
        setSettingsBarber(barber);
        setActiveTab(tab);
        setPhotoError(null);
        setLicenseInput(barber.license_number ?? '');
        // Extract handle from full URL or bare handle
        const raw = barber.instagram_url ?? '';
        const handle = raw.includes('instagram.com/')
            ? raw.split('instagram.com/').pop()?.replace(/^@/, '') ?? ''
            : raw.replace(/^@/, '');
        setInstagramInput(handle);
        const edits = await buildServiceEdits(barber);
        setServiceEdits(edits);
        setServicesOffered(edits.filter((e) => e.enabled).map((e) => e.name));
        // Parse working_hours — default to canonical shop hours if not set
        const wh: WorkingHours = barber.working_hours as WorkingHours ?? {};
        const defaults: WorkingHours = {};
        for (const day of DAYS) {
            defaults[day] = wh[day] !== undefined ? wh[day] : (DEFAULT_HOURS[day] ?? null);
        }
        setWorkingHours(defaults);
        setSaved(false);
    };

    const closeSettings = () => { setSettingsBarber(null); setSaved(false); setPhotoError(null); };

    const toggleService = (serviceUuid: string) => {
        setServiceEdits((prev) => {
            const next = prev.map((edit) =>
                edit.serviceUuid === serviceUuid
                    ? { ...edit, enabled: !edit.enabled }
                    : edit,
            );
            setServicesOffered(next.filter((e) => e.enabled).map((e) => e.name));
            return next;
        });
        setSaved(false);
    };

    const updateServiceField = (
        serviceUuid: string,
        field: 'priceCents' | 'durationMinutes',
        value: number,
    ) => {
        setServiceEdits((prev) =>
            prev.map((edit) =>
                edit.serviceUuid === serviceUuid ? { ...edit, [field]: value } : edit,
            ),
        );
        setSaved(false);
    };

    const toggleDay = (day: DayKey) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: prev[day] ? null : { ...(DEFAULT_HOURS[day] ?? DEFAULT_WEEKDAY) },
        }));
        setSaved(false);
    };

    const setDayTime = (day: DayKey, field: 'open' | 'close', value: string) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...(prev[day] ?? DEFAULT_HOURS[day] ?? DEFAULT_WEEKDAY), [field]: value },
        }));
        setSaved(false);
    };

    const saveSettings = async () => {
        if (!settingsBarber) return;
        setSaving(true);
        setSaveError(null);
        const handle = instagramInput.trim().replace(/^@/, '');
        const enabledServices = serviceEdits.filter((e) => e.enabled);
        const update = {
            license_number: licenseInput.trim() || null,
            instagram_url: handle ? `https://www.instagram.com/${handle}` : null,
            services_offered: enabledServices.length > 0 ? enabledServices.map((e) => e.name) : null,
            working_hours: workingHours,
        };

        const { error: barberErr } = await supabase
            .from('barbers')
            .update(update)
            .eq('id', settingsBarber.id);

        if (barberErr) {
            setSaving(false);
            setSaveError(barberErr.message);
            return;
        }

        const offerings = enabledServices.map((e) => ({
            serviceId: e.serviceUuid,
            priceCents: e.priceCents,
            durationMinutes: e.durationMinutes,
        }));

        const { data: { session } } = await supabase.auth.getSession();
        const servicesRes = await fetch('/api/barber-services', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {}),
            },
            body: JSON.stringify({ barberId: settingsBarber.id, offerings }),
        });

        if (!servicesRes.ok) {
            const body = await servicesRes.json().catch(() => ({}));
            setSaving(false);
            setSaveError((body as { error?: string }).error ?? 'Failed to save service pricing');
            return;
        }

        const refreshedEdits = await buildServiceEdits({ ...settingsBarber, ...update });
        setServiceEdits(refreshedEdits);
        setServicesOffered(refreshedEdits.filter((e) => e.enabled).map((e) => e.name));

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
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/barbers/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {}),
            },
            body: JSON.stringify({
                barberId: barber.id,
                origin: window.location.origin,
            }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            alert((body as { error?: string }).error ?? 'Failed to approve barber');
            return;
        }

        const body = await res.json() as { barber?: Barber; email?: { success: boolean; error?: string } };
        setBarbers(prev => prev.map(b => b.id === barber.id ? { ...b, active: true } : b));

        if (body.email && !body.email.success && body.email.error) {
            console.warn('Welcome email failed:', body.email.error);
        }
    };

    const copyBookingLink = (slug: string) => {
        navigator.clipboard.writeText(barberBookingPageUrl(slug, window.location.origin));
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    const copyPortalLink = (slug: string) => {
        navigator.clipboard.writeText(barberPortalLoginUrl(slug, window.location.origin));
        setCopiedPortalSlug(slug);
        setTimeout(() => setCopiedPortalSlug(null), 2000);
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-page">

            {/* Header */}
            <div className="admin-header">
                <div>
                    <p className="admin-kicker">Team</p>
                    <h1 className="admin-title">Barbers</h1>
                    <p className="admin-subtitle">
                        Manage your team, schedules, booking links, and portal access.
                    </p>
                </div>
                <button
                    onClick={copyRegistrationLink}
                    className="admin-action-btn px-5 py-3 bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all glow-blue shrink-0"
                >
                    {copiedReg ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {copiedReg ? 'Link Copied!' : 'Copy Join Link'}
                </button>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="card-savron flex items-center gap-4 py-4 px-5">
                    <div className="w-10 h-10 rounded-savron bg-savron-green/15 border border-savron-green/25 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-accent-blue" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/50">Active</p>
                        <p className="text-2xl font-heading text-white">{active.length}</p>
                    </div>
                </div>
                <div className="card-savron flex items-center gap-4 py-4 px-5">
                    <div className="w-10 h-10 rounded-savron bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/50">Pending</p>
                        <p className="text-2xl font-heading text-white">{pending.length}</p>
                    </div>
                </div>
                <div className="card-savron flex items-center gap-4 py-4 px-5">
                    <div className="w-10 h-10 rounded-savron bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0">
                        <Scissors className="w-5 h-5 text-blue-300" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/50">Total Team</p>
                        <p className="text-2xl font-heading text-white">{barbers.length}</p>
                    </div>
                </div>
            </div>

            {/* Join-form applications (applicants table) */}
            <BarberApplicationsPanel />

            {/* Pending approvals — inactive barbers who completed /join onboarding */}
            {pending.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-savron bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                            <UserCheck className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                                Pending Approval
                            </p>
                            <p className="text-sm text-savron-silver/60">{pending.length} barber{pending.length !== 1 ? 's' : ''} waiting to join the team</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                        {pending.map(barber => (
                            <div key={barber.id} className="card-savron border-amber-500/20 space-y-4 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/60 via-amber-400/30 to-transparent" />
                                <div className="flex items-start gap-3">
                                    <div className="w-14 h-14 rounded-full overflow-hidden bg-savron-charcoal border border-amber-500/20 relative shrink-0">
                                        {barber.image_url ? (
                                            <Image src={barber.image_url} alt={barber.name} fill sizes="56px" className="object-cover" />
                                        ) : (
                                            <span className="absolute inset-0 flex items-center justify-center text-base font-heading text-white/30">
                                                {barber.name.charAt(0)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-white font-heading uppercase tracking-wider text-sm">{barber.name}</h3>
                                            <span className="shrink-0 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                                Pending
                                            </span>
                                        </div>
                                        {barber.email && (
                                            <p className="text-savron-silver/50 text-xs truncate flex items-center gap-1.5 mt-1">
                                                <Mail className="w-3 h-3 shrink-0" /> {barber.email}
                                            </p>
                                        )}
                                        {barber.phone && (
                                            <p className="text-savron-silver/70 text-xs flex items-center gap-1.5 mt-0.5">
                                                <Phone className="w-3 h-3 shrink-0" /> {barber.phone}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {barber.bio && (
                                    <p className="text-savron-silver/50 text-xs leading-relaxed line-clamp-2">{barber.bio}</p>
                                )}
                                {barber.specialties && barber.specialties.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {barber.specialties.map((s, i) => (
                                            <span key={i} className="text-[9px] uppercase tracking-wider text-savron-silver/60 bg-savron-charcoal px-2 py-0.5 border border-white/5 rounded-savron">{s}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => approveBarber(barber)}
                                        className="admin-action-btn flex-1 bg-savron-green hover:bg-savron-green-light text-white border border-savron-green/50 hover:border-savron-green-light transition-all rounded-savron"
                                    >
                                        <UserCheck className="w-4 h-4" /> Approve
                                    </button>
                                    <button
                                        onClick={() => openSettings(barber)}
                                        className="admin-action-btn px-4 border border-white/15 text-white hover:bg-white/10 hover:border-white/30 rounded-savron transition-all"
                                        title="Review profile before approving"
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span className="sr-only">Review</span>
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
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-savron bg-savron-green/10 border border-savron-green/25 flex items-center justify-center">
                            <Users className="w-4 h-4 text-accent-blue" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/70">Active Team</p>
                            <p className="text-sm text-savron-silver/60">{active.length} barber{active.length !== 1 ? 's' : ''} currently on the roster</p>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                    {active.map(barber => (
                        <div key={barber.id} className="card-savron space-y-4 hover:border-white/15 transition-colors">
                            <div className="flex items-start gap-4">
                                <button
                                    onClick={() => openSettings(barber, 'profile')}
                                    className="relative w-16 h-16 rounded-full overflow-hidden bg-savron-charcoal border-2 border-savron-green/20 shrink-0 group"
                                    title="Edit profile photo"
                                >
                                    {barber.image_url ? (
                                        <Image src={barber.image_url} alt={barber.name} fill sizes="64px" className="object-cover" />
                                    ) : (
                                        <span className="absolute inset-0 flex items-center justify-center text-lg font-heading text-white/30">
                                            {barber.name.charAt(0)}
                                        </span>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity">
                                        <Camera className="w-4 h-4 text-white" />
                                    </div>
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-white font-heading uppercase tracking-wider">{barber.name}</h3>
                                        <span className="shrink-0 inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-savron-green/15 text-accent-blue border border-savron-green/25">
                                            <span className="w-1.5 h-1.5 rounded-full bg-savron-green inline-block" />
                                            Active
                                        </span>
                                    </div>
                                    <p className="text-accent-blue text-xs uppercase tracking-widest mt-0.5">{barber.role}</p>
                                    {barber.email && (
                                        <p className="text-savron-silver/50 text-xs mt-2 truncate flex items-center gap-1.5">
                                            <Mail className="w-3 h-3 shrink-0" /> {barber.email}
                                        </p>
                                    )}
                                    {barber.license_number && (
                                        <p className="text-savron-silver/70 text-[10px] mt-1 flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3 shrink-0" /> {barber.license_number}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-savron bg-savron-charcoal/60 border border-white/5 px-3 py-2.5">
                                    <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Schedule
                                    </p>
                                    <p className="text-xs text-savron-silver/80 leading-snug">{scheduleSummary(barber)}</p>
                                </div>
                                <div className="rounded-savron bg-savron-charcoal/60 border border-white/5 px-3 py-2.5">
                                    <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1 flex items-center gap-1">
                                        <Layers className="w-3 h-3" /> Services
                                    </p>
                                    <p className="text-xs text-savron-silver/80">
                                        {barber.services_offered?.length
                                            ? `${barber.services_offered.length} offered`
                                            : 'All services'}
                                    </p>
                                </div>
                            </div>

                            {barber.services_offered && barber.services_offered.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {barber.services_offered.slice(0, 3).map((s, i) => (
                                        <span key={i} className="text-[10px] uppercase tracking-wider text-savron-silver bg-savron-charcoal px-2 py-1 border border-white/5 rounded-savron">{s}</span>
                                    ))}
                                    {barber.services_offered.length > 3 && (
                                        <span className="text-[10px] text-savron-silver/50 px-2 py-1">
                                            +{barber.services_offered.length - 3} more
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => toggleActive(barber)}
                                    className="admin-action-btn w-full justify-start px-0 min-h-0 py-0 text-xs uppercase tracking-wider transition-all text-accent-blue hover:text-savron-cream font-medium bg-transparent border-0"
                                >
                                    <ToggleRight className="w-4 h-4" /> Set Inactive
                                </button>
                                <BarberCardActions
                                    barber={barber}
                                    copiedPortalSlug={copiedPortalSlug}
                                    copiedSlug={copiedSlug}
                                    onCopyPortalLink={copyPortalLink}
                                    onCopyBookingLink={copyBookingLink}
                                    onOpenSettings={openSettings}
                                    onArchive={setConfirmDelete}
                                />
                            </div>
                        </div>
                    ))}

                    {active.length === 0 && (
                        <div className="col-span-full card-savron flex flex-col items-center justify-center text-center py-16 px-6">
                            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                <Users className="w-7 h-7 text-savron-silver/40" />
                            </div>
                            <h3 className="font-heading text-white uppercase tracking-wider text-lg mb-2">No active barbers yet</h3>
                            <p className="text-savron-silver/60 text-sm max-w-md mb-6">
                                Share your join link with new barbers, or approve pending applicants above.
                            </p>
                            <button
                                onClick={copyRegistrationLink}
                                className="admin-action-btn bg-savron-green/15 hover:bg-savron-green/25 border border-savron-green/30 text-accent-blue hover:text-savron-cream rounded-savron transition-all"
                            >
                                {copiedReg ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                {copiedReg ? 'Link Copied!' : 'Copy Join Link'}
                            </button>
                        </div>
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
                        className="glass-panel-strong border-red-500/20 rounded-savron p-6 max-w-sm w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-savron bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-heading text-lg text-white uppercase tracking-wider">Archive Barber?</h3>
                                <p className="text-savron-silver/60 text-xs mt-0.5">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-savron-silver/70 text-sm mb-6">
                            Remove <span className="text-white font-medium">{confirmDelete.name}</span> from your team. Their profile, links, and calendar access will be removed.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="admin-action-btn flex-1 border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                            >
                                <X className="w-4 h-4" /> Cancel
                            </button>
                            <button
                                onClick={() => deleteBarber(confirmDelete)}
                                className="admin-action-btn flex-1 bg-red-600 hover:bg-red-700 text-white rounded-savron transition-all font-medium"
                            >
                                <Trash2 className="w-4 h-4" /> Archive
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
                        className="fixed top-0 right-0 h-full w-full max-w-md glass-panel-strong border-l border-white/10 z-50 flex flex-col overflow-hidden shadow-2xl"
                    >
                        {/* Panel header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 relative shrink-0">
                                    {settingsBarber.image_url ? (
                                        <Image src={settingsBarber.image_url} alt={settingsBarber.name} fill sizes="40px" className="object-cover" />
                                    ) : (
                                        <span className="absolute inset-0 flex items-center justify-center text-xs font-heading text-white/30">
                                            {settingsBarber.name.charAt(0)}
                                        </span>
                                    )}
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
                        <div className="flex border-b border-white/5 shrink-0 px-2">
                            {SETTINGS_TABS.map(({ key, label, icon: Icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    className={cn(
                                        "flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 px-1 text-[10px] uppercase tracking-widest transition-colors",
                                        activeTab === key
                                            ? "text-white border-b-2 border-savron-green-light"
                                            : "text-savron-silver/50 hover:text-savron-silver"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>

                        <div
                            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-8"
                            data-lenis-prevent
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >

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
                                                        ? <Image src={settingsBarber.image_url} alt={settingsBarber.name} fill sizes="96px" className="object-cover" />
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
                                                    if (!file || !settingsBarber) return;
                                                    setPhotoError(null);
                                                    setUploadingPhoto(true);
                                                    try {
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        const formData = new FormData();
                                                        formData.append('barberId', settingsBarber.id);
                                                        formData.append('file', file);

                                                        const res = await fetch('/api/admin/barber-photo', {
                                                            method: 'POST',
                                                            headers: session?.access_token
                                                                ? { Authorization: `Bearer ${session.access_token}` }
                                                                : {},
                                                            body: formData,
                                                        });

                                                        const body = await res.json().catch(() => ({}));
                                                        if (!res.ok) {
                                                            throw new Error((body as { error?: string }).error ?? 'Upload failed');
                                                        }

                                                        const imageUrl = (body as { imageUrl: string }).imageUrl;
                                                        setSettingsBarber(prev => prev ? { ...prev, image_url: imageUrl } : prev);
                                                        setBarbers(prev => prev.map(b =>
                                                            b.id === settingsBarber.id ? { ...b, image_url: imageUrl } : b
                                                        ));
                                                    } catch (err) {
                                                        console.error('Photo upload failed:', err);
                                                        setPhotoError(err instanceof Error ? err.message : 'Photo upload failed.');
                                                        e.currentTarget.value = '';
                                                    } finally {
                                                        setUploadingPhoto(false);
                                                    }
                                                }}
                                            />
                                            <label htmlFor="photo-upload" className={cn(
                                                "admin-action-btn px-6 bg-savron-green/10 text-savron-green border border-savron-green/30 hover:bg-savron-green/20 rounded-savron cursor-pointer transition-all font-medium",
                                                uploadingPhoto && "opacity-50 pointer-events-none",
                                            )}>
                                                <Upload className="w-4 h-4" />
                                                {uploadingPhoto ? 'Uploading…' : settingsBarber.image_url ? 'Change Photo' : 'Upload Photo'}
                                            </label>
                                            {photoError && (
                                                <p className="text-red-400 text-[11px] text-center max-w-xs">{photoError}</p>
                                            )}
                                        </div>
                                    </div>

                                    {(settingsBarber.portfolio_images?.length ?? 0) > 0 && (
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-3">
                                                Portfolio Photos
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {settingsBarber.portfolio_images!.slice(0, 6).map((url, i) => (
                                                    <div key={`${url}-${i}`} className="relative aspect-square rounded-savron overflow-hidden bg-savron-charcoal border border-white/10">
                                                        <Image src={url} alt={`${settingsBarber.name} portfolio ${i + 1}`} fill sizes="96px" className="object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                            {settingsBarber.portfolio_images!.length > 6 && (
                                                <p className="text-savron-silver/40 text-[10px] mt-2">
                                                    +{settingsBarber.portfolio_images!.length - 6} more in barber profile
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* License number */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-3 flex items-center gap-2">
                                            <ShieldCheck className="w-3.5 h-3.5" /> Professional License
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
                                            <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 flex items-center gap-2">
                                                <Mail className="w-3.5 h-3.5" /> Contact
                                            </label>
                                            {settingsBarber.email && (
                                                <p className="text-savron-silver/70 text-sm flex items-center gap-2">
                                                    <Mail className="w-3.5 h-3.5 shrink-0 opacity-50" /> {settingsBarber.email}
                                                </p>
                                            )}
                                            {settingsBarber.phone && (
                                                <p className="text-savron-silver/70 text-sm flex items-center gap-2">
                                                    <Phone className="w-3.5 h-3.5 shrink-0 opacity-50" /> {settingsBarber.phone}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── SERVICES TAB ─────────────────────────────────── */}
                            {activeTab === 'services' && (
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-1 flex items-center gap-2">
                                            <Layers className="w-3.5 h-3.5" /> Services Offered
                                        </label>
                                    <p className="text-savron-silver/70 text-xs mb-4">
                                        Toggle services and set this barber&apos;s price and duration for each.
                                    </p>
                                    <div className="space-y-3">
                                        {serviceEdits.map((svc) => (
                                            <div
                                                key={svc.serviceUuid}
                                                className={cn(
                                                    "border rounded-savron transition-all",
                                                    svc.enabled
                                                        ? "bg-savron-green/5 border-savron-green/25"
                                                        : "bg-savron-charcoal border-white/5",
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleService(svc.serviceUuid)}
                                                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                                                >
                                                    <p className="text-sm font-medium text-white">{svc.name}</p>
                                                    {svc.enabled
                                                        ? <ToggleRight className="w-5 h-5 text-savron-green shrink-0" />
                                                        : <ToggleLeft className="w-5 h-5 shrink-0 text-savron-silver/40" />
                                                    }
                                                </button>
                                                {svc.enabled && (
                                                    <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                                                        <div>
                                                            <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1.5">
                                                                Price ($)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step={1}
                                                                value={Math.round(svc.priceCents / 100)}
                                                                onChange={(e) => updateServiceField(
                                                                    svc.serviceUuid,
                                                                    'priceCents',
                                                                    Math.max(0, parseInt(e.target.value || '0', 10) * 100),
                                                                )}
                                                                className="w-full bg-savron-black border border-white/10 text-white px-3 py-2 text-sm rounded-savron focus:outline-none focus:border-savron-green/50"
                                                            />
                                                            <p className="text-[10px] text-savron-silver/40 mt-1">
                                                                Shop default: ${svc.defaultPriceCents / 100}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1.5">
                                                                Duration (min)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={5}
                                                                step={5}
                                                                value={svc.durationMinutes}
                                                                onChange={(e) => updateServiceField(
                                                                    svc.serviceUuid,
                                                                    'durationMinutes',
                                                                    Math.max(5, parseInt(e.target.value || '0', 10)),
                                                                )}
                                                                className="w-full bg-savron-black border border-white/10 text-white px-3 py-2 text-sm rounded-savron focus:outline-none focus:border-savron-green/50"
                                                            />
                                                            <p className="text-[10px] text-savron-silver/40 mt-1">
                                                                Shop default: {svc.defaultDurationMinutes} min
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── LINKS TAB ────────────────────────────────────── */}
                            {activeTab === 'links' && settingsBarber && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2 flex items-center gap-2">
                                            <LinkIcon className="w-3.5 h-3.5" /> Portal Login Link
                                        </label>
                                        <p className="text-savron-silver/60 text-xs mb-3">
                                            Send this to the barber so they can sign in and open their calendar portal.
                                        </p>
                                        <div className="flex items-center gap-3 bg-savron-charcoal border border-white/10 rounded-savron p-3">
                                            <span className="text-savron-silver text-xs font-mono truncate flex-1">
                                                {barberPortalLoginUrl(settingsBarber.slug, typeof window !== 'undefined' ? window.location.origin : '')}
                                            </span>
                                            <button
                                                onClick={() => copyPortalLink(settingsBarber.slug)}
                                                className="shrink-0 admin-action-btn px-3 py-1.5 border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                                            >
                                                {copiedPortalSlug === settingsBarber.slug ? <Check className="w-3.5 h-3.5 text-savron-green" /> : <Copy className="w-3.5 h-3.5" />}
                                                {copiedPortalSlug === settingsBarber.slug ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-2 flex items-center gap-2">
                                            <ExternalLink className="w-3.5 h-3.5" /> Client Booking Link
                                        </label>
                                        <p className="text-savron-silver/60 text-xs mb-3">
                                            Public page where clients book appointments with this barber.
                                        </p>
                                        <div className="flex items-center gap-3 bg-savron-charcoal border border-white/10 rounded-savron p-3">
                                            <span className="text-savron-silver text-xs font-mono truncate flex-1">
                                                {barberBookingPageUrl(settingsBarber.slug, typeof window !== 'undefined' ? window.location.origin : '')}
                                            </span>
                                            <button
                                                onClick={() => copyBookingLink(settingsBarber.slug)}
                                                className="shrink-0 admin-action-btn px-3 py-1.5 border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                                            >
                                                {copiedSlug === settingsBarber.slug ? <Check className="w-3.5 h-3.5 text-savron-green" /> : <Copy className="w-3.5 h-3.5" />}
                                                {copiedSlug === settingsBarber.slug ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <Link
                                            href={adminBarberPortalUrl(settingsBarber.id, settingsBarber.slug)}
                                            className="admin-action-btn w-full bg-savron-green/10 text-savron-green border border-savron-green/30 hover:bg-savron-green/20 rounded-savron transition-all"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open Barber Portal
                                        </Link>
                                        <a
                                            href={barberBookingPageUrl(settingsBarber.slug, typeof window !== 'undefined' ? window.location.origin : '')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="admin-action-btn w-full border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open Booking Page
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* ── SCHEDULE TAB ─────────────────────────────────── */}
                            {activeTab === 'schedule' && (
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-1 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" /> Working Hours
                                    </p>
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
                                                                ? <><ToggleRight className="w-5 h-5 text-accent-blue" /><span className="text-accent-blue uppercase tracking-widest text-[10px]">Open</span></>
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
                        <div className="p-6 border-t border-white/5 shrink-0 space-y-3">
                            {saveError && (
                                <p className="text-red-400 text-[11px] text-center">{saveError}</p>
                            )}
                            <button
                                onClick={saveSettings}
                                disabled={saving}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest font-medium rounded-savron transition-all disabled:opacity-50",
                                    saved
                                        ? "bg-savron-green/20 text-accent-blue border border-savron-green/35"
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
