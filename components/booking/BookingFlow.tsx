"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { TIME_SLOTS, BOOKING_SLOT_INTERVAL_MINS, generateTimeSlots } from '@/lib/services-data';
import { useServices } from '@/lib/use-services';
import { DatePicker } from './DatePicker';
import { triggerPostBooking } from '@/lib/confirm-booking';
import { isSlotInPast, nextBookableDate, slotConflictsWithBusy } from '@/lib/time-helpers';
import BarberPortfolioGallery from './BarberPortfolioGallery';
import {
    barberOffersAnyService,
    barberOffersService,
    bookingTotals,
    formatBookingServices,
    resolveServiceFromParam,
    serviceNamesForIds,
} from '@/lib/booking-utils';
import { EyebrowsAddon } from './EyebrowsAddon';

const STEP_TRANSITION = { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const };

const nullBarber = { auth_id: null, bio: null, phone: null, email: null, instagram_url: null, license_number: null, services_offered: null, google_calendar_id: null, google_calendar_tokens: null, google_sync_token: null, google_channel_id: null, google_resource_id: null, working_hours: null, portfolio_images: null, booking_links: null, created_at: '' };
const PLACEHOLDER_BARBERS: Barber[] = [
    { ...nullBarber, id: 'ph-1', name: 'Albi A.',   slug: 'albi-a',   role: 'Master Barber & Owner', specialties: ['Skin Fades', 'Beard Design'],         image_url: null, active: true },
    { ...nullBarber, id: 'ph-2', name: 'Marcus V.', slug: 'marcus-v', role: 'Master Barber',          specialties: ['Signature Fades', 'Hot Towel Shaves'], image_url: null, active: true },
    { ...nullBarber, id: 'ph-3', name: 'James D.',  slug: 'james-d',  role: 'Senior Stylist',         specialties: ['Modern Cuts', 'Textured Styles'],      image_url: null, active: true },
    { ...nullBarber, id: 'ph-4', name: 'Leo R.',    slug: 'leo-r',    role: 'Barber',                 specialties: ['Classic Cuts', 'Kids Cuts'],           image_url: null, active: true },
];

type BookingFlowProps = {
    preselectedServiceName?: string | null;
};

const BookingFlow = ({ preselectedServiceName }: BookingFlowProps) => {
    const supabase = createClient();
    const services = useServices();
    const [step, setStep] = useState(1);
    const [preselectionApplied, setPreselectionApplied] = useState(false);
    const [selectedServices, setSelectedServices] = useState<number[]>([]);
    const [selectedPro, setSelectedPro] = useState<Barber | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(() => nextBookableDate());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [clientEmail, setClientEmail] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientMessage, setClientMessage] = useState('');
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [loadingBarbers, setLoadingBarbers] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [profileOpen, setProfileOpen] = useState<Barber | null>(null);

    const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([]);
    const [loadingBusy, setLoadingBusy] = useState(false);
    const [barbersError, setBarbersError] = useState(false);
    const [portfolioGallery, setPortfolioGallery] = useState<Barber | null>(null);
    const [addEyebrows, setAddEyebrows] = useState(false);
    const flowRef = useRef<HTMLDivElement>(null);
    const skipStepScroll = useRef(true);

    useEffect(() => {
        if (preselectionApplied || !preselectedServiceName) return;
        const match = resolveServiceFromParam(preselectedServiceName, services);
        if (match) {
            setSelectedServices([match.id]);
        }
        setPreselectionApplied(true);
    }, [preselectedServiceName, services, preselectionApplied]);

    useEffect(() => {
        if (skipStepScroll.current) {
            skipStepScroll.current = false;
            return;
        }
        const el = flowRef.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, [step]);

    useEffect(() => {
        if (!selectedPro) return;
        setSelectedServices((prev) =>
            prev.filter((id) => {
                const name = services.find((s) => s.id === id)?.name;
                return name ? barberOffersService(selectedPro, name) : false;
            }),
        );
    }, [selectedPro, services]);

    useEffect(() => {
        async function fetchBarbers() {
            setLoadingBarbers(true);
            setBarbersError(false);
            const { data, error } = await supabase
                .from('barbers')
                .select('*')
                .eq('active', true)
                .order('name');
            if (error) {
                console.error('[BookingFlow] Failed to fetch barbers:', error);
                setBarbersError(true);
            }
            if (data && data.length > 0) setBarbers(data);
            setLoadingBarbers(false);
        }
        fetchBarbers();
    }, []);

    const toggleService = (id: number) => {
        const scrollY = window.scrollY;
        setSelectedServices(prev => {
            const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
            if (next.length === 0) setAddEyebrows(false);
            return next;
        });
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' as ScrollBehavior }));
    };

    const basePriceCents = selectedServices.reduce((sum, id) => {
        const s = services.find(s => s.id === id);
        return sum + (s ? s.priceCents : 0);
    }, 0);

    const baseDurationMin = selectedServices.reduce((sum, id) => {
        const s = services.find(s => s.id === id);
        return sum + (s?.durationMin ?? 0);
    }, 0);

    const totals = bookingTotals(basePriceCents, baseDurationMin, addEyebrows);
    const totalPrice = totals.priceCents / 100;
    const totalDurationMin = totals.durationMin;

    useEffect(() => {
        if (!selectedPro || !selectedDate) {
            setBusySlots([]);
            return;
        }
        async function fetchBusy() {
            setLoadingBusy(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const res = await fetch(`/api/calendar/busy?barberId=${selectedPro?.id}&date=${dateStr}`);
                if (res.ok) {
                    const data = await res.json();
                    setBusySlots(data.busy || []);
                } else {
                    setBusySlots([]);
                }
            } catch (err) {
                console.error('[BookingFlow] Error fetching busy slots', err);
                setBusySlots([]);
            }
            setLoadingBusy(false);
        }
        fetchBusy();
    }, [selectedPro, selectedDate]);

    const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const selectedDayKey = DAY_KEYS[selectedDate.getDay()];

    const availableSlots = (() => {
        const wh = selectedPro?.working_hours as Record<string, { open: string; close: string } | null> | null;
        if (!wh) return TIME_SLOTS;
        const day = wh[selectedDayKey];
        if (!day) return [];
        return generateTimeSlots(day.open, day.close, BOOKING_SLOT_INTERVAL_MINS);
    })();

    const isBarberOffToday = selectedPro?.working_hours !== null && availableSlots.length === 0;

    const isSlotBusy = (timeStr: string) => {
        if (isSlotInPast(selectedDate, timeStr, 5)) return true;
        if (loadingBusy) return true;
        if (busySlots.length === 0) return false;
        return slotConflictsWithBusy(selectedDate, timeStr, totalDurationMin || 45, busySlots);
    };

    const handleConfirm = async () => {
        setSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const serviceNames = formatBookingServices(
            selectedServices
                .map(id => services.find(s => s.id === id)?.name)
                .filter((name): name is string => Boolean(name)),
            addEyebrows,
        );

        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        const { data: inserted, error: insertError } = await supabase.from('bookings').insert({
            client_name: clientName || null,
            client_email: clientEmail || null,
            client_phone: clientPhone || null,
            service: serviceNames,
            barber_id: selectedPro?.id,
            barber_name: selectedPro?.name || '',
            date: dateStr,
            time: selectedTime,
            duration: totals.duration,
            price: totals.price,
            status: 'confirmed',
            notes: clientMessage.trim() || null,
        }).select('id').single();

        if (insertError) {
            console.error('[BookingFlow] Insert error:', insertError);
            setSubmitting(false);
            alert(insertError.code === '23505'
                ? 'That appointment was just booked. Please choose another time.'
                : 'We could not create your appointment. Please try again.');
            return;
        }

        if (inserted?.id) {
            console.log('[BookingFlow] Booking created:', inserted.id, '— triggering email + calendar sync');
            triggerPostBooking(inserted.id);
        } else {
            console.warn('[BookingFlow] Booking insert returned no ID — email will NOT be sent.');
            setSubmitting(false);
            alert('We could not confirm your appointment. Please try again.');
            return;
        }

        setSubmitting(false);
        setStep(5);
    };

    const selectedServiceNames = serviceNamesForIds(services, selectedServices);
    const displayServiceLine = formatBookingServices(selectedServiceNames, addEyebrows);
    const displayBarbers = barbers.filter((pro) =>
        barberOffersAnyService(pro, selectedServiceNames),
    );

    /* ─── STEP 1: Services ───────────────────────────────────── */
    const renderServiceStep = () => (
        <motion.div key="services" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={STEP_TRANSITION}>
            <div className="mb-5">
                <h2 className="text-xl md:text-2xl font-heading text-white uppercase tracking-wider">Select Services</h2>
                <p className="text-savron-silver/65 text-sm mt-1.5">Tap a service to continue — you can add more than one.</p>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
                {services.map((service) => {
                    const isSelected = selectedServices.includes(service.id);
                    return (
                        <button
                            key={service.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleService(service.id)}
                            className={cn(
                                "w-full px-4 py-4 border cursor-pointer transition-all duration-300 flex justify-between items-center group min-h-[72px] touch-manipulation text-left",
                                isSelected
                                    ? "border-savron-green/50 bg-savron-green/5"
                                    : "border-white/[0.06] hover:border-white/15 bg-savron-black"
                            )}
                        >
                            <div className="min-w-0 pr-3">
                                <h3 className="text-white font-medium uppercase tracking-wide text-sm">{service.name}</h3>
                                {service.description && (
                                    <p className="text-savron-silver/55 text-sm mt-1 leading-relaxed max-w-md">{service.description}</p>
                                )}
                                <p className="text-savron-silver/45 text-xs mt-1 flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 shrink-0" /> {service.duration}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className={cn("font-mono text-sm transition-colors duration-300", isSelected ? "text-savron-silver" : "text-savron-silver/50 group-hover:text-savron-silver")}>{service.price}</span>
                                <div className={cn("w-5 h-5 flex items-center justify-center transition-all duration-300 flex-shrink-0", isSelected ? "text-savron-blue-light" : "text-white/10")}>
                                    {isSelected ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border border-white/20" />}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </motion.div>
    );

    /* ─── STEP 2: Select Barber ──────────────────────────────── */
    const renderProStep = () => (
        <motion.div key="pro" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={STEP_TRANSITION}>
            <div className="mb-5">
                <h2 className="text-xl md:text-2xl font-heading text-white uppercase tracking-wider">Select Your Barber</h2>
                <p className="text-savron-silver/65 text-sm mt-1.5">
                    {selectedServiceNames.length > 0
                        ? `Showing barbers who offer ${selectedServiceNames.join(', ')}.`
                        : 'Tap a card to select your barber.'}
                </p>
            </div>
            {loadingBarbers ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                </div>
            ) : barbersError ? (
                <div className="text-center py-12 space-y-3">
                    <p className="text-savron-silver/60 text-sm">Unable to load team</p>
                    <button
                        onClick={() => {
                            setBarbers([]);
                            setBarbersError(false);
                            setLoadingBarbers(true);
                            supabase.from('barbers').select('*').eq('active', true).order('name')
                                .then(({ data, error }) => {
                                    if (error) setBarbersError(true);
                                    if (data && data.length > 0) setBarbers(data);
                                    setLoadingBarbers(false);
                                });
                        }}
                        className="text-xs text-savron-blue-light uppercase tracking-widest hover:text-savron-blue-light transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : displayBarbers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                    <p className="text-savron-silver/60 text-sm">No barbers currently offer this service.</p>
                    <button
                        onClick={() => setStep(1)}
                        className="text-sm text-savron-blue-light uppercase tracking-widest hover:text-savron-blue-light transition-colors min-h-[44px] px-4"
                    >
                        Choose a different service
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {displayBarbers.map((pro) => {
                        const hasPortfolio = (pro.portfolio_images?.length ?? 0) > 0;
                        const isSelected = selectedPro?.id === pro.id;
                        return (
                            <div
                                key={pro.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedPro(pro)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPro(pro); } }}
                                className={cn(
                                    "relative overflow-hidden p-4 border cursor-pointer transition-all duration-300 flex flex-col items-center justify-between text-center gap-3 group rounded-savron min-h-[168px] touch-manipulation",
                                    isSelected
                                        ? "border-savron-green bg-savron-green/10"
                                        : "border-white/[0.06] hover:border-white/20 bg-savron-black"
                                )}
                            >
                                {/* Selection Indicator */}
                                <div className="absolute top-2.5 left-2.5">
                                    <div className={cn(
                                        "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                                        isSelected
                                            ? "border-savron-green-light bg-savron-green-light text-white"
                                            : "border-white/25 bg-transparent"
                                    )}>
                                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                                    </div>
                                </div>

                                {/* Avatar */}
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 flex-shrink-0 relative transition-transform duration-300 group-hover:scale-105 mt-2">
                                    {pro.image_url ? (
                                        <Image
                                            src={pro.image_url}
                                            alt={pro.name}
                                            fill
                                            className={cn("object-cover transition-all duration-300", isSelected ? "grayscale-0" : "grayscale group-hover:grayscale-0")}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-savron-silver/40 text-sm font-heading">
                                            {pro.name.charAt(0)}
                                        </div>
                                    )}
                                </div>

                                {/* Barber Info */}
                                <div className="space-y-1">
                                    <h3 className="text-white text-sm font-heading uppercase tracking-widest leading-tight">{pro.name}</h3>
                                    <p className="text-savron-silver/45 text-[11px] uppercase tracking-wider leading-tight">{pro.role}</p>
                                </div>

                                {/* Card Actions Footer */}
                                <div className="flex gap-2 w-full justify-center pt-2 border-t border-white/[0.04] mt-auto">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProfileOpen(pro);
                                        }}
                                        className="text-[11px] uppercase tracking-widest text-savron-silver/50 hover:text-white transition-colors px-3 py-1.5 min-h-[36px] bg-white/5 hover:bg-white/10 rounded-sm"
                                    >
                                        Bio
                                    </button>
                                    {hasPortfolio && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPortfolioGallery(pro);
                                            }}
                                            className="text-[11px] uppercase tracking-widest text-savron-silver/50 hover:text-white transition-colors px-3 py-1.5 min-h-[36px] bg-white/5 hover:bg-white/10 rounded-sm"
                                        >
                                            Work
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Profile slide-out */}
            <AnimatePresence>
                {profileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setProfileOpen(null)}
                            className="fixed inset-0 bg-black/70 z-40"
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                            className="fixed right-0 top-0 h-full w-full max-w-sm bg-savron-grey border-l border-white/10 z-50 flex flex-col"
                        >
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <span className="text-xs uppercase tracking-widest text-savron-silver">Profile</span>
                                <button onClick={() => setProfileOpen(null)} className="text-savron-silver hover:text-white transition-colors text-xl leading-none">×</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                <div className="w-20 h-20 rounded-full overflow-hidden bg-savron-black border-2 border-savron-green/30 relative mx-auto">
                                    {profileOpen.image_url ? (
                                        <Image src={profileOpen.image_url} alt={profileOpen.name} fill sizes="80px" className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-savron-silver/40 text-2xl font-heading">{profileOpen.name.charAt(0)}</div>
                                    )}
                                </div>
                                <div className="text-center space-y-1">
                                    <h3 className="font-heading text-xl uppercase tracking-widest text-white">{profileOpen.name}</h3>
                                    <p className="text-savron-silver/60 text-[10px] uppercase tracking-[0.3em]">{profileOpen.role}</p>
                                </div>
                                {profileOpen.bio && <p className="text-savron-silver text-sm leading-relaxed">{profileOpen.bio}</p>}
                                {profileOpen.specialties && profileOpen.specialties.length > 0 && (
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-savron-silver/40 mb-2">Specialties</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {profileOpen.specialties.map((s, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-savron-green/10 text-savron-blue-light border border-savron-green/20 text-[10px] uppercase tracking-wider">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {profileOpen.instagram_url && (() => {
                                    const raw = profileOpen.instagram_url;
                                    const handle = raw.includes('instagram.com/')
                                        ? raw.split('instagram.com/').pop()?.replace(/^@/, '') ?? raw
                                        : raw.replace(/^@/, '');
                                    const href = `https://www.instagram.com/${handle}`;
                                    return (
                                        <a href={href} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-savron-silver hover:text-white transition-colors text-sm">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                                            @{handle}
                                        </a>
                                    );
                                })()}
                            </div>
                            <div className="p-5 border-t border-white/5">
                                <Button onClick={() => { setSelectedPro(profileOpen); setProfileOpen(null); }} className="w-full">
                                    Book with {profileOpen.name.split(' ')[0]}
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Mobile portfolio gallery modal */}
            {portfolioGallery && portfolioGallery.portfolio_images && (
                <BarberPortfolioGallery
                    images={portfolioGallery.portfolio_images}
                    name={portfolioGallery.name}
                    mode="modal"
                    open
                    onClose={() => setPortfolioGallery(null)}
                />
            )}
        </motion.div>
    );

    /* ─── STEP 3: Date & Time ────────────────────────────────── */
    const renderDateTimeStep = () => {
        const slotHour = (t: string) => {
            const [time, period] = t.split(' ');
            let h = parseInt(time.split(':')[0]);
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h;
        };

        const openSlots = availableSlots.filter(t => !isSlotBusy(t));
        const morning   = openSlots.filter(t => slotHour(t) < 12);
        const afternoon = openSlots.filter(t => { const h = slotHour(t); return h >= 12 && h < 17; });
        const evening   = openSlots.filter(t => slotHour(t) >= 17);

        const TimeGroup = ({ label, slots }: { label: string; slots: string[] }) => {
            if (slots.length === 0) return null;
            return (
                <div className="mb-6">
                    <p className="text-xs uppercase tracking-[0.18em] text-savron-silver/40 mb-3">{label}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slots.map((time, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedTime(time)}
                                className={cn(
                                    "py-4 min-h-[52px] border transition-all duration-300 text-center text-sm font-mono touch-manipulation",
                                    selectedTime === time
                                        ? "border-savron-green/50 bg-savron-green/10 text-white"
                                        : "border-white/[0.07] hover:border-white/20 text-savron-silver/50 hover:text-white"
                                )}
                            >
                                {time}
                            </button>
                        ))}
                    </div>
                </div>
            );
        };

        return (
            <motion.div key="datetime" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={STEP_TRANSITION}>
                <h2 className="text-xl md:text-2xl font-heading text-white uppercase tracking-wider mb-2">Select Date & Time</h2>
                <p className="text-savron-silver/65 text-sm mb-6">
                    With {selectedPro?.name} · {displayServiceLine}
                    {addEyebrows && <span className="text-savron-blue-light/80"> · includes eyebrows</span>}
                </p>

                {/* Date row */}
                <div className="mb-7">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/30 mb-3">Date</p>
                    <DatePicker selected={selectedDate} onChange={(d) => { setSelectedDate(d); setSelectedTime(null); }} />
                </div>

                {/* Time section */}
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/30 mb-4">Time</p>
                    {loadingBusy ? (
                        <div className="py-10 flex items-center justify-center gap-2 text-savron-silver/25 text-xs uppercase tracking-widest">
                            <span className="animate-pulse">●</span> Checking availability
                        </div>
                    ) : isBarberOffToday ? (
                        <div className="py-10 text-center space-y-2">
                            <p className="text-savron-silver/40 text-sm uppercase tracking-widest">Not Available</p>
                            <p className="text-savron-silver/25 text-xs">{selectedPro?.name} is off on {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}s</p>
                        </div>
                    ) : openSlots.length === 0 ? (
                        <div className="py-10 text-center space-y-2">
                            <p className="text-savron-silver/40 text-sm uppercase tracking-widest">Fully Booked</p>
                            <p className="text-savron-silver/25 text-xs">Try a different date</p>
                        </div>
                    ) : (
                        <div>
                            <TimeGroup label="Morning"   slots={morning} />
                            <TimeGroup label="Afternoon" slots={afternoon} />
                            <TimeGroup label="Evening"   slots={evening} />
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    /* ─── STEP 4: Details ────────────────────────────────────── */
    const renderDetailsStep = () => (
        <motion.div key="details" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={STEP_TRANSITION}>
            <h2 className="text-xl md:text-2xl font-heading text-white uppercase tracking-wider mb-4">Your Details</h2>
            {/* Summary */}
            <div className="bg-savron-black border border-white/[0.06] p-4 mb-4 space-y-2.5 text-sm">
                <p className="text-savron-silver/55 uppercase tracking-widest text-xs mb-3">Booking Summary</p>
                <div className="flex justify-between">
                    <span className="text-savron-silver/70">Services</span>
                    <span className="text-white text-right max-w-[55%]">{displayServiceLine}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-savron-silver/70">Barber</span>
                    <span className="text-white">{selectedPro?.name}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-savron-silver/70">Date</span>
                    <span className="text-white">{format(selectedDate, 'EEE, MMM d')}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-savron-silver/70">Time</span>
                    <span className="text-white">{selectedTime}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/[0.06] mt-1">
                    <span className="text-savron-silver/70">Total</span>
                    <span className="text-white font-mono text-base">{totals.price}</span>
                </div>
            </div>
            {/* Inputs */}
            <div className="space-y-3">
                <input placeholder="YOUR NAME" value={clientName} onChange={(e) => setClientName(e.target.value)} className="input-savron" />
                <input type="email" placeholder="YOUR EMAIL" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="input-savron" />
                <input type="tel" placeholder="YOUR PHONE" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="input-savron" />
                <textarea
                    placeholder="MESSAGE FOR YOUR BARBER (OPTIONAL)"
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="input-savron resize-none"
                />
            </div>
        </motion.div>
    );

    /* ─── STEP 5: Confirmation ───────────────────────────────── */
    const renderConfirmation = () => (
        <motion.div key="confirm" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }} className="text-center space-y-4 py-8">
            <div className="w-12 h-12 border border-savron-silver/30 flex items-center justify-center mx-auto">
                <Check className="w-5 h-5 text-savron-silver" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/50">Confirmed</p>
            <h2 className="text-2xl font-heading text-white uppercase tracking-wider">You&apos;re all set</h2>
            <p className="text-savron-silver/60 text-sm leading-relaxed">
                {format(selectedDate, 'EEEE, MMMM d')} at{' '}
                <span className="text-white">{selectedTime}</span> with{' '}
                <span className="text-white">{selectedPro?.name}</span>.
            </p>
            <p className="text-[10px] text-savron-silver/30 uppercase tracking-[0.3em]">Confirmation sent to your email</p>
            <Button variant="outline" onClick={() => {
                setStep(1); setSelectedServices([]); setSelectedPro(null);
                setPreselectionApplied(true);
                setAddEyebrows(false);
                setSelectedDate(nextBookableDate()); setSelectedTime(null);
                setClientName(''); setClientEmail(''); setClientPhone(''); setClientMessage('');
            }}>
                Book Another
            </Button>
        </motion.div>
    );

    const steps = [1, 2, 3, 4];

    return (
        <div ref={flowRef} className="bg-savron-grey border border-white/[0.06] relative">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-savron-silver/15 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-savron-silver/15 pointer-events-none" />

            {/* Progress bar */}
            {step < 5 && (
                <div className="flex gap-1 px-6 pt-5">
                    {steps.map((s) => (
                        <div key={s} className={cn("h-px flex-1 transition-all duration-700", s <= step ? "bg-savron-silver/50" : "bg-white/[0.06]")} />
                    ))}
                </div>
            )}

            {/* Content — page scrolls naturally, no nested scroll */}
            <div className="px-4 sm:px-6 pt-5 pb-4">
                <AnimatePresence mode="wait">
                    {step === 1 && renderServiceStep()}
                    {step === 2 && renderProStep()}
                    {step === 3 && renderDateTimeStep()}
                    {step === 4 && renderDetailsStep()}
                    {step === 5 && renderConfirmation()}
                </AnimatePresence>
            </div>

            {/* Footer nav */}
            {step < 5 && (
                <div className="border-t border-white/[0.04]">
                    {step === 1 && (
                        <EyebrowsAddon
                            variant="footer"
                            visible={selectedServices.length > 0}
                            checked={addEyebrows}
                            onChange={setAddEyebrows}
                        />
                    )}
                    <div className="flex justify-between px-6 py-4">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex gap-1.5 text-xs">
                            <ChevronLeft className="w-3.5 h-3.5" /> Back
                        </Button>
                    ) : <div />}
                    <div>
                        {step === 1 && <Button onClick={() => setStep(2)} disabled={selectedServices.length === 0}>Next <ChevronRight className="w-3.5 h-3.5 ml-1.5" /></Button>}
                        {step === 2 && <Button onClick={() => setStep(3)} disabled={!selectedPro}>Next <ChevronRight className="w-3.5 h-3.5 ml-1.5" /></Button>}
                        {step === 3 && <Button onClick={() => setStep(4)} disabled={!selectedTime}>Next <ChevronRight className="w-3.5 h-3.5 ml-1.5" /></Button>}
                        {step === 4 && <Button onClick={handleConfirm} isLoading={submitting} disabled={!clientName || !clientEmail}>Confirm Booking</Button>}
                    </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingFlow;
