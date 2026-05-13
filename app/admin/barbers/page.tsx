"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scissors, Copy, Check, ToggleLeft, ToggleRight, UserCheck,
    Link as LinkIcon, Settings, X, Save, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { useServices } from '@/lib/use-services';

export default function AdminBarbersPage() {
    const supabase = createClient();
    const services = useServices();
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
    const [copiedReg, setCopiedReg] = useState(false);

    // Settings panel
    const [settingsBarber, setSettingsBarber] = useState<Barber | null>(null);
    const [licenseInput, setLicenseInput] = useState('');
    const [servicesOffered, setServicesOffered] = useState<string[]>([]);
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

    const openSettings = (barber: Barber) => {
        setSettingsBarber(barber);
        setLicenseInput(barber.license_number ?? '');
        // Default: all services if none configured yet
        setServicesOffered(barber.services_offered ?? services.map(s => s.name));
        setSaved(false);
    };

    const closeSettings = () => { setSettingsBarber(null); setSaved(false); };

    const toggleService = (name: string) =>
        setServicesOffered(prev =>
            prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
        );

    const saveSettings = async () => {
        if (!settingsBarber) return;
        setSaving(true);
        const update = {
            license_number: licenseInput.trim() || null,
            services_offered: servicesOffered.length > 0 ? servicesOffered : null,
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
                                        {barber.phone && <p className="text-savron-silver/40 text-xs">{barber.phone}</p>}
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
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] uppercase tracking-widest bg-savron-green/10 border border-savron-green/20 text-savron-green hover:bg-savron-green/20 transition-all"
                                    >
                                        <UserCheck className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => openSettings(barber)}
                                        className="px-3 py-2.5 border border-white/10 text-savron-silver hover:text-white hover:border-white/25 transition-all"
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
                    <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/40 mb-4">Active Team</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {active.map(barber => (
                        <div key={barber.id} className="bg-savron-grey border border-white/5 rounded-savron p-6 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 relative shrink-0">
                                    {barber.image_url
                                        ? <Image src={barber.image_url} alt={barber.name} fill className="object-cover" />
                                        : <Scissors className="w-5 h-5 text-white/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-heading uppercase tracking-wider">{barber.name}</h3>
                                    <p className="text-savron-green text-xs uppercase tracking-widest">{barber.role}</p>
                                    {barber.email && <p className="text-savron-silver/50 text-xs mt-1 truncate">{barber.email}</p>}
                                    {barber.license_number && (
                                        <p className="text-savron-silver/40 text-[10px] mt-0.5 flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> {barber.license_number}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {barber.services_offered && barber.services_offered.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {barber.services_offered.map((s, i) => (
                                        <span key={i} className="text-[10px] uppercase tracking-wider text-savron-silver bg-savron-charcoal px-2 py-1 border border-white/5 rounded-savron">{s}</span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <button
                                    onClick={() => toggleActive(barber)}
                                    className="flex items-center gap-2 text-xs uppercase tracking-wider transition-all text-green-400 hover:text-red-400"
                                >
                                    <ToggleRight className="w-4 h-4" /> Active
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => copyBookingLink(barber.slug)}
                                        className="flex items-center gap-1 text-xs uppercase tracking-wider text-savron-silver hover:text-white transition-all"
                                    >
                                        {copiedSlug === barber.slug ? <Check className="w-3 h-3 text-savron-green" /> : <Copy className="w-3 h-3" />}
                                        {copiedSlug === barber.slug ? 'Copied' : 'Link'}
                                    </button>
                                    <button
                                        onClick={() => openSettings(barber)}
                                        className="flex items-center gap-1 text-xs uppercase tracking-wider text-savron-silver hover:text-white transition-all"
                                    >
                                        <Settings className="w-3.5 h-3.5" /> Settings
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {active.length === 0 && (
                        <p className="text-savron-silver/30 text-sm col-span-3">No active barbers yet.</p>
                    )}
                </div>
            </div>
        </motion.div>

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
                        className="fixed top-0 right-0 h-full w-full max-w-md bg-savron-grey border-l border-white/10 z-50 flex flex-col overflow-y-auto shadow-2xl"
                    >
                        {/* Panel header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/50 mb-1">Barber Settings</p>
                                <h2 className="font-heading text-lg text-white uppercase tracking-wider">{settingsBarber.name}</h2>
                            </div>
                            <button onClick={closeSettings} className="text-savron-silver hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 p-6 space-y-8">
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

                            {/* Services offered */}
                            <div>
                                <label className="block text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 mb-1">
                                    Services Offered
                                </label>
                                <p className="text-savron-silver/40 text-xs mb-4">Only toggled services appear on this barber&apos;s booking page.</p>
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
                        </div>

                        {/* Save footer */}
                        <div className="p-6 border-t border-white/5 shrink-0">
                            <button
                                onClick={saveSettings}
                                disabled={saving}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest font-medium rounded-savron transition-all disabled:opacity-50",
                                    saved
                                        ? "bg-savron-green/10 text-savron-green border border-savron-green/20"
                                        : "bg-savron-green text-black hover:bg-opacity-90"
                                )}
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
