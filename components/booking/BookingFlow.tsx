"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { TIME_SLOTS } from '@/lib/services-data';
import { useServices } from '@/lib/use-services';
import { DatePicker } from './DatePicker';
import { triggerPostBooking } from '@/lib/confirm-booking';
import { isSlotInPast, nextBookableDate } from '@/lib/time-helpers';
import BarberPortfolioGallery from './BarberPortfolioGallery';

const nullBarber = { auth_id: null, bio: null, phone: null, email: null, instagram_url: null, license_number: null, services_offered: null, google_calendar_id: null, google_calendar_tokens: null, google_sync_token: null, google_channel_id: null, google_resource_id: null, working_hours: null, portfolio_images: null, created_at: '' };
const PLACEHOLDER_BARBERS: Barber[] = [
    { ...nullBarber, id: 'ph-1', name: 'Albi A.',   slug: 'albi-a',   role: 'Master Barber & Owner', specialties: ['Skin Fades', 'Beard Design'],         image_url: null, active: true },
    { ...nullBarber, id: 'ph-2', name: 'Marcus V.', slug: 'marcus-v', role: 'Master Barber',          specialties: ['Signature Fades', 'Hot Towel Shaves'], image_url: null, active: true },
    { ...nullBarber, id: 'ph-3', name: 'James D.',  slug: 'james-d',  role: 'Senior Stylist',         specialties: ['Modern Cuts', 'Textured Styles'],      image_url: null, active: true },
    { ...nullBarber, id: 'ph-4', name: 'Leo R.',    slug: 'leo-r',    role: 'Barber',                 specialties: ['Classic Cuts', 'Kids Cuts'],           image_url: null, active: true },
];

const BookingFlow = () => {
    const supabase = createClient();
    const services = useServices();
    const [step, setStep] = useState(1);
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
        setSelectedServices(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const totalPrice = selectedServices.reduce((sum, id) => {
        const s = services.find(s => s.id === id);
        return sum + (s ? s.priceCents / 100 : 0);
    }, 0);

    const totalDurationMin = selectedServices.reduce((sum, id) => {
        const s = services.find(s => s.id === id);
        return sum + (s?.durationMin ?? 0);
    }, 0);

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

    const isSlotBusy = (timeStr: string) => {
        // Past times are always disabled (with 5-min buffer for the current slot)
        if (isSlotInPast(selectedDate, timeStr, 5)) return true;

        if (loadingBusy) return true; // Disable until loaded
        if (busySlots.length === 0) return false;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const [timePart, meridiem] = timeStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;

        // Use fixed offset matching Central Time (-05:00) to align with Google Calendar Helper
        const slotStart = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`).getTime();
        const slotEnd = slotStart + (totalDurationMin || 45) * 60000;

        return busySlots.some(busy => {
            const bStart = new Date(busy.start).getTime();
            const bEnd = new Date(busy.end).getTime();
            return slotStart < bEnd && slotEnd > bStart;
        });
    };

    const handleConfirm = async () => {
        setSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const serviceNames = selectedServices
            .map(id => services.find(s => s.id === id)?.name)
            .filter(Boolean)
            .join(', ');

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
            duration: `${selectedServices.reduce((sum, id) => sum + (services.find(s => s.id === id)?.durationMin ?? 0), 0)} min`,
            price: `$${totalPrice}`,
            status: 'confirmed',
            notes: clientMessage.trim() || null,
        }).select('id').single();

        if (insertError) {
            console.error('[BookingFlow] Insert error:', insertError);
        }

        if (inserted?.id) {
            console.log('[BookingFlow] Booking created:', inserted.id, '— triggering email + calendar sync');
            triggerPostBooking(inserted.id);
        } else {
            console.warn('[BookingFlow] Booking insert returned no ID — email will NOT be sent. Error:', insertError);
        }

        setSubmitting(false);
        setStep(5);
    };

    const displayBarbers = barbers;

    /* ─── STEP 2: Services ───────────────────────────────────── */
    const renderServiceStep = () => (
        <motion.div key="services" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="mb-4">
                <h2 className="text-xl font-heading text-white uppercase tracking-wider">Select Services</h2>
                <p className="text-savron-silver/60 text-xs uppercase tracking-widest mt-1">Select one or more</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
                {services.filter(s =>
                    !selectedPro?.services_offered || selectedPro.services_offered.includes(s.name)
                ).map((service) => {
                    const isSelected = selectedServices.includes(service.id);
                    return (
                        <div
                            key={service.id}
                            onClick={() => toggleService(service.id)}
                            className={cn(
                                "px-4 py-3 border cursor-pointer transition-all duration-200 flex justify-between items-center group",
                                isSelected
                                    ? "border-savron-green/50 bg-savron-green/5"
                                    : "border-white/[0.06] hover:border-white/15 bg-savron-black"
                            )}
                        >
                            <div>
                                <h3 className="text-white font-medium uppercase tracking-widest text-xs">{service.name}</h3>
                                <p className="text-savron-silver/40 text-[10px] mt-0.5 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> {service.duration}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={cn("font-mono text-sm transition-colors duration-200", isSelected ? "text-savron-silver" : "text-savron-silver/50 group-hover:text-savron-silver")}>{service.price}</span>
                                <div className={cn("w-4 h-4 flex items-center justify-center transition-all duration-200 flex-shrink-0", isSelected ? "text-emerald-400" : "text-white/10")}>
                                    {isSelected ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border border-white/20" />}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );

    /* ─── STEP 1: Select Barber ──────────────────────────────── */
    const renderProStep = () => (
        <motion.div key="pro" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="mb-4">
                <h2 className="text-xl font-heading text-white uppercase tracking-wider">Select Professional</h2>
                <p className="text-savron-silver/60 text-xs uppercase tracking-widest mt-1">Tap a card to select</p>
            </div>
            {loadingBarbers ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                </div>
            ) : barbersError || displayBarbers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                    <p className="text-savron-silver/60 text-xs uppercase tracking-widest">Unable to load team</p>
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
                        className="text-xs text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {displayBarbers.map((pro) => {
                        const hasPortfolio = (pro.portfolio_images?.length ?? 0) > 0;
                        const isSelected = selectedPro?.id === pro.id;
                        return (
                            <div
                                key={pro.id}
                                onClick={() => setSelectedPro(pro)}
                                className={cn(
                                    "relative overflow-hidden p-4 border cursor-pointer transition-all duration-300 flex flex-col items-center justify-between text-center gap-3 group rounded-savron min-h-[160px]",
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
                                    <h3 className="text-white text-xs font-heading uppercase tracking-widest leading-tight">{pro.name}</h3>
                                    <p className="text-savron-silver/40 text-[9px] uppercase tracking-wider leading-tight">{pro.role}</p>
                                </div>

                                {/* Card Actions Footer */}
                                <div className="flex gap-2 w-full justify-center pt-2 border-t border-white/[0.04] mt-auto">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProfileOpen(pro);
                                        }}
                                        className="text-[9px] uppercase tracking-widest text-savron-silver/40 hover:text-white transition-colors px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-sm"
                                    >
                                        Bio
                                    </button>
                                    {hasPortfolio && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPortfolioGallery(pro);
                                            }}
                                            className="text-[9px] uppercase tracking-widest text-savron-silver/40 hover:text-white transition-colors px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-sm"
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
                                        <Image src={profileOpen.image_url} alt={profileOpen.name} fill className="object-cover" />
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
                                                <span key={i} className="px-2 py-0.5 bg-savron-green/10 text-emerald-400 border border-savron-green/20 text-[10px] uppercase tracking-wider">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {profileOpen.instagram_url && (
                                    <a href={profileOpen.instagram_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-savron-silver hover:text-white transition-colors text-sm">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                                        @{profileOpen.instagram_url.split('/').pop()}
                                    </a>
                                )}
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
    const renderDateTimeStep = () => (
        <motion.div key="datetime" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 className="text-xl font-heading text-white uppercase tracking-wider mb-4">Select Date & Time</h2>
            <div className="md:grid md:grid-cols-2 md:gap-6 space-y-5 md:space-y-0">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-2">Date</p>
                    <DatePicker selected={selectedDate} onChange={(d) => { setSelectedDate(d); setSelectedTime(null); }} />
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-2">Time</p>
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
                        {loadingBusy ? (
                            <div className="col-span-full py-6 flex justify-center text-savron-silver/40 text-xs uppercase">
                                Checking availability...
                            </div>
                        ) : (
                            TIME_SLOTS.map((time, idx) => {
                                const busy = isSlotBusy(time);
                                return (
                                    <button
                                        key={idx}
                                        disabled={busy}
                                        onClick={() => !busy && setSelectedTime(time)}
                                        className={cn(
                                            "py-2.5 border transition-all duration-200 text-center text-[10px] font-mono tracking-wider w-full",
                                            busy
                                                ? "opacity-30 cursor-not-allowed border-white/[0.02] bg-white/[0.01] line-through text-savron-silver/30"
                                                : selectedTime === time
                                                    ? "border-savron-green/60 bg-savron-green/10 text-white cursor-pointer"
                                                    : "border-white/[0.06] hover:border-white/20 text-savron-silver/50 hover:text-savron-silver cursor-pointer"
                                        )}
                                    >
                                        {time}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );

    /* ─── STEP 4: Details ────────────────────────────────────── */
    const renderDetailsStep = () => (
        <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 className="text-xl font-heading text-white uppercase tracking-wider mb-4">Your Details</h2>
            {/* Summary */}
            <div className="bg-savron-black border border-white/[0.06] p-3 mb-4 space-y-1.5 text-xs">
                <p className="text-savron-silver/40 uppercase tracking-widest text-[10px] mb-2">Booking Summary</p>
                <div className="flex justify-between">
                    <span className="text-savron-silver/60">Services</span>
                    <span className="text-white text-right max-w-[55%]">{selectedServices.map(id => services.find(s => s.id === id)?.name).join(', ')}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-savron-silver/60">Barber</span>
                    <span className="text-white">{selectedPro?.name}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-savron-silver/60">Date</span>
                    <span className="text-white">{format(selectedDate, 'EEE, MMM d')}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-savron-silver/60">Time</span>
                    <span className="text-white">{selectedTime}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-white/[0.06] mt-1">
                    <span className="text-savron-silver/60">Total</span>
                    <span className="text-white font-mono">${totalPrice}</span>
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
        <motion.div key="confirm" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center space-y-4 py-8">
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
                setSelectedDate(nextBookableDate()); setSelectedTime(null);
                setClientName(''); setClientEmail(''); setClientPhone(''); setClientMessage('');
            }}>
                Book Another
            </Button>
        </motion.div>
    );

    const steps = [1, 2, 3, 4];

    return (
        <div className="bg-savron-grey border border-white/[0.06] relative">
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

            {/* Scrollable content */}
            <div className="px-6 pt-5 pb-4 overflow-y-auto max-h-[65vh]">
                <AnimatePresence mode="wait">
                    {step === 1 && renderProStep()}
                    {step === 2 && renderServiceStep()}
                    {step === 3 && renderDateTimeStep()}
                    {step === 4 && renderDetailsStep()}
                    {step === 5 && renderConfirmation()}
                </AnimatePresence>
            </div>

            {/* Sticky nav */}
            {step < 5 && (
                <div className="flex justify-between px-6 py-4 border-t border-white/[0.04]">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex gap-1.5 text-xs">
                            <ChevronLeft className="w-3.5 h-3.5" /> Back
                        </Button>
                    ) : <div />}
                    <div>
                        {step === 1 && <Button onClick={() => setStep(2)} disabled={!selectedPro}>Next <ChevronRight className="w-3.5 h-3.5 ml-1.5" /></Button>}
                        {step === 2 && <Button onClick={() => setStep(3)} disabled={selectedServices.length === 0}>Next <ChevronRight className="w-3.5 h-3.5 ml-1.5" /></Button>}
                        {step === 3 && <Button onClick={() => setStep(4)} disabled={!selectedTime}>Next <ChevronRight className="w-3.5 h-3.5 ml-1.5" /></Button>}
                        {step === 4 && <Button onClick={handleConfirm} isLoading={submitting} disabled={!clientName || !clientEmail}>Confirm Booking</Button>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingFlow;
