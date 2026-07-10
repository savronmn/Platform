"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { TIME_SLOTS, generateTimeSlots } from '@/lib/services-data';
import { useServices } from '@/lib/use-services';
import { DatePicker } from '@/components/booking/DatePicker';
import { triggerPostBooking } from '@/lib/confirm-booking';
import { isSlotInPast, nextBookableDate, slotConflictsWithBusy } from '@/lib/time-helpers';
import BarberPortfolioGallery from '@/components/booking/BarberPortfolioGallery';

export default function BarberBookingPage() {
    const params = useParams();
    const slug = params.slug as string;
    const supabase = createClient();
    const services = useServices();

    const [barber, setBarber] = useState<Barber | null>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [selectedService, setSelectedService] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(() => nextBookableDate());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientMessage, setClientMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [portfolioOpen, setPortfolioOpen] = useState(false);
    const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([]);
    const [workingHours, setWorkingHours] = useState<Record<string, { open: string; close: string } | null> | null>(null);
    const [loadingBusy, setLoadingBusy] = useState(false);

    useEffect(() => {
        if (!barber || !selectedDate) return;
        async function fetchBusy() {
            setLoadingBusy(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const res = await fetch(`/api/calendar/busy?barberId=${barber!.id}&date=${dateStr}`);
                if (res.ok) {
                    const data = await res.json();
                    setBusySlots(data.busy || []);
                    setWorkingHours(data.workingHours ?? null);
                } else {
                    setBusySlots([]);
                }
            } catch {
                setBusySlots([]);
            }
            setLoadingBusy(false);
        }
        fetchBusy();
    }, [barber, selectedDate]);

    // Day-of-week key from selected date (Mon, Tue, ... Sun)
    const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const selectedDayKey = DAY_KEYS[selectedDate.getDay()];

    // Is this entire day off for the barber?
    const isDayOff = workingHours !== null && (workingHours[selectedDayKey] === null || workingHours[selectedDayKey] === undefined);

    const isSlotBusy = (timeStr: string) => {
        if (isSlotInPast(selectedDate, timeStr, 5)) return true;
        if (loadingBusy) return true;
        if (busySlots.length === 0) return false;
        const service = services.find(s => s.id === selectedService);
        const durationMin = service?.durationMin ?? 45;
        return slotConflictsWithBusy(selectedDate, timeStr, durationMin, busySlots);
    };

    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('barbers').select('*').eq('slug', slug).single();
            setBarber(data);
            setLoading(false);
        }
        load();
    }, [slug]);

    const handleConfirm = async () => {
        setSubmitting(true);
        const service = services.find(s => s.id === selectedService);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        const { data: inserted, error: insertError } = await supabase.from('bookings').insert({
            client_name: clientName,
            client_email: clientEmail,
            client_phone: clientPhone,
            service: service?.name || '',
            barber_id: barber?.id,
            barber_name: barber?.name || '',
            date: dateStr,
            time: selectedTime,
            duration: service ? `${service.durationMin} min` : '45 min',
            price: service?.price || '',
            status: 'confirmed',
            notes: clientMessage.trim() || null,
        }).select('id').single();

        if (insertError || !inserted?.id) {
            setSubmitting(false);
            alert(insertError?.code === '23505'
                ? 'That appointment was just booked. Please choose another time.'
                : 'We could not create your appointment. Please try again.');
            return;
        }

        triggerPostBooking(inserted.id);

        setSubmitting(false);
        setStep(4);
    };

    const resetBooking = () => {
        setStep(1);
        setSelectedService(null);
        setSelectedDate(nextBookableDate());
        setSelectedTime(null);
        setClientName('');
        setClientEmail('');
        setClientPhone('');
        setClientMessage('');
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-savron-black flex items-center justify-center pt-20">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </main>
        );
    }

    if (!barber) {
        return (
            <main className="min-h-screen bg-savron-black flex items-center justify-center pt-20">
                <div className="text-center space-y-4">
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Not Found</h1>
                    <p className="text-savron-silver text-sm">This booking page does not exist.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-savron-black pt-20 pb-16">
            {/* Barber header */}
            <section className="px-6 md:px-12 lg:px-24 py-12">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col md:flex-row items-center md:items-start gap-8"
                    >
                        <div className="w-28 h-28 rounded-full overflow-hidden bg-savron-grey border-2 border-savron-green/30 relative shrink-0">
                            {barber.image_url ? (
                                <Image src={barber.image_url} alt={barber.name} fill sizes="112px" className="object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-heading text-savron-silver/50">
                                    {barber.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="text-center md:text-left space-y-3">
                            <h1 className="font-heading text-4xl md:text-5xl uppercase tracking-widest text-white">{barber.name}</h1>
                            <p className="text-emerald-400 uppercase tracking-widest text-sm font-medium">{barber.role}</p>
                            {barber.bio && <p className="text-savron-silver text-sm leading-relaxed max-w-lg">{barber.bio}</p>}
                            {barber.specialties && barber.specialties.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                    {barber.specialties.map((s, i) => (
                                        <span key={i} className="badge bg-savron-green/15 text-emerald-400 border border-savron-green/30 text-xs">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {barber.instagram_url && (() => {
                                const raw = barber.instagram_url;
                                const handle = raw.includes('instagram.com/')
                                    ? raw.split('instagram.com/').pop()?.replace(/^@/, '') ?? raw
                                    : raw.replace(/^@/, '');
                                const href = `https://www.instagram.com/${handle}`;
                                return (
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-savron-silver hover:text-white transition-colors text-sm"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                                            <circle cx="12" cy="12" r="4"/>
                                            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                                        </svg>
                                        @{handle}
                                    </a>
                                );
                            })()}
                            {/* Portfolio gallery trigger */}
                            {(barber.portfolio_images?.length ?? 0) > 0 && (
                                <button
                                    onClick={() => setPortfolioOpen(true)}
                                    className="glass-panel inline-flex items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-widest text-white/80 hover:text-white transition-all"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                    View Work ({barber.portfolio_images!.length})
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Portfolio gallery modal */}
            {barber.portfolio_images && (
                <BarberPortfolioGallery
                    images={barber.portfolio_images}
                    name={barber.name}
                    mode="modal"
                    open={portfolioOpen}
                    onClose={() => setPortfolioOpen(false)}
                />
            )}

            {/* Booking flow */}
            <section className="px-6 md:px-12 lg:px-24">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-savron-grey border border-white/5 p-5 sm:p-8 md:p-12 rounded-savron">
                        {step < 4 && (
                            <div className="flex gap-2 mb-10">
                                {[1, 2, 3].map(s => (
                                    <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", s <= step ? "bg-savron-green" : "bg-white/10")} />
                                ))}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {/* Step 1: Service */}
                            {step === 1 && (
                                <motion.div key="service" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                                    <h2 className="text-xl font-heading text-white uppercase tracking-widest mb-6">Select Service</h2>
                                    {services.filter(s =>
                                        !barber.services_offered?.length || barber.services_offered.includes(s.name)
                                    ).map(service => (
                                        <div
                                            key={service.id}
                                            onClick={() => setSelectedService(service.id)}
                                            className={cn(
                                                "p-4 border rounded-savron cursor-pointer transition-all flex justify-between items-center",
                                                selectedService === service.id ? "border-savron-green bg-savron-green/10" : "border-white/10 hover:border-white/30"
                                            )}
                                        >
                                            <div>
                                                <h3 className="text-white font-medium uppercase tracking-wide text-sm">{service.name}</h3>
                                                {service.description && (
                                                    <p className="text-savron-silver/50 text-xs mt-1 leading-relaxed max-w-md">{service.description}</p>
                                                )}
                                                <p className="text-savron-silver text-xs mt-1 flex items-center gap-2">
                                                    <Clock className="w-3 h-3" /> {service.duration}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-white font-mono text-sm">{service.price}</span>
                                                {selectedService === service.id && <Check className="w-4 h-4 text-emerald-400" />}
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {/* Step 2: Date + Time */}
                            {step === 2 && (
                                <motion.div key="datetime" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                    <h2 className="text-xl font-heading text-white uppercase tracking-widest mb-2">Select Date & Time</h2>
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-savron-silver/50 mb-3">Date</p>
                                        <DatePicker selected={selectedDate} onChange={(d) => { setSelectedDate(d); setSelectedTime(null); }} />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-widest text-savron-silver/50 mb-3">Time</p>
                                        {loadingBusy ? (
                                            <div className="py-6 text-center text-savron-silver/40 text-xs uppercase">Checking availability…</div>
                                        ) : isDayOff ? (
                                            <div className="py-8 text-center space-y-2">
                                                <p className="text-savron-silver/40 text-sm uppercase tracking-widest">Not available</p>
                                                <p className="text-savron-silver/25 text-xs">This barber is off on {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}s.</p>
                                            </div>
                                        ) : (() => {
                                            const daySchedule = workingHours?.[selectedDayKey];
                                            const availableSlots = daySchedule
                                                ? generateTimeSlots(daySchedule.open, daySchedule.close)
                                                : TIME_SLOTS;
                                            if (availableSlots.length === 0) {
                                                return (
                                                    <div className="py-8 text-center">
                                                        <p className="text-savron-silver/40 text-sm uppercase tracking-widest">No slots available</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {availableSlots.map((time, idx) => {
                                                        const busy = isSlotBusy(time);
                                                        return (
                                                            <button
                                                                key={idx}
                                                                disabled={busy}
                                                                onClick={() => !busy && setSelectedTime(time)}
                                                                className={cn(
                                                                    "p-3 border rounded-savron transition-all text-center text-sm font-mono w-full",
                                                                    busy
                                                                        ? "opacity-30 cursor-not-allowed border-white/5 text-savron-silver/30 line-through"
                                                                        : selectedTime === time
                                                                            ? "border-savron-green bg-savron-green text-white cursor-pointer"
                                                                            : "border-white/10 hover:border-white/30 text-savron-silver cursor-pointer"
                                                                )}
                                                            >
                                                                {time}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3: Details */}
                            {step === 3 && (
                                <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                                    <h2 className="text-xl font-heading text-white uppercase tracking-widest mb-2">Your Details</h2>
                                    <div className="bg-savron-black border border-white/10 rounded-savron p-4 space-y-2 text-sm">
                                        <p className="text-savron-silver text-xs uppercase tracking-widest mb-3">Summary</p>
                                        <div className="flex justify-between">
                                            <span className="text-savron-silver">Service</span>
                                            <span className="text-white">{services.find(s => s.id === selectedService)?.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-savron-silver">Date</span>
                                            <span className="text-white">{format(selectedDate, 'EEE, MMM d')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-savron-silver">Time</span>
                                            <span className="text-white">{selectedTime}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-white/10">
                                            <span className="text-savron-silver font-mono font-bold">Total</span>
                                            <span className="text-emerald-400 font-mono font-bold">{services.find(s => s.id === selectedService)?.price}</span>
                                        </div>
                                    </div>
                                    <input required placeholder="FULL NAME" value={clientName} onChange={e => setClientName(e.target.value)} className="input-savron" />
                                    <input required type="email" placeholder="EMAIL" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="input-savron" />
                                    <input required type="tel" placeholder="PHONE" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="input-savron" />
                                    <textarea
                                        placeholder="MESSAGE FOR YOUR BARBER (OPTIONAL)"
                                        value={clientMessage}
                                        onChange={e => setClientMessage(e.target.value)}
                                        rows={3}
                                        maxLength={500}
                                        className="input-savron resize-none"
                                    />
                                </motion.div>
                            )}

                            {/* Step 4: Confirmed */}
                            {step === 4 && (
                                <motion.div key="confirm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 py-8">
                                    <div className="w-16 h-16 bg-savron-green rounded-full flex items-center justify-center mx-auto">
                                        <Check className="w-8 h-8 text-white" />
                                    </div>
                                    <h2 className="text-3xl font-heading text-white uppercase tracking-wider">Confirmed</h2>
                                    <p className="text-savron-silver">
                                        {format(selectedDate, 'EEEE, MMMM d')} at{' '}
                                        <span className="text-white font-bold">{selectedTime}</span> with{' '}
                                        <span className="text-white font-bold">{barber.name}</span>.
                                    </p>
                                    <p className="text-xs text-savron-silver/50 uppercase tracking-widest">Check your email for details</p>
                                    <button
                                        onClick={resetBooking}
                                        className="mx-auto mt-2 flex items-center gap-2 px-6 py-3.5 min-h-[44px] border border-white/10 text-xs uppercase tracking-widest text-savron-silver hover:text-white hover:border-white/25 transition-all rounded-savron touch-manipulation select-none"
                                    >
                                        Book Another Appointment
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Navigation */}
                        {step < 4 && (
                            <div className="flex justify-between mt-10 pt-6 border-t border-white/5">
                                {step > 1 ? (
                                    <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex gap-2">
                                        <ChevronLeft className="w-4 h-4" /> Back
                                    </Button>
                                ) : <div />}
                                <div>
                                    {step === 1 && (
                                        <Button onClick={() => setStep(2)} disabled={!selectedService}>
                                            Next <ChevronRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    )}
                                    {step === 2 && (
                                        <Button onClick={() => setStep(3)} disabled={!selectedTime}>
                                            Next <ChevronRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    )}
                                    {step === 3 && (
                                        <Button onClick={handleConfirm} isLoading={submitting} disabled={!clientName || !clientEmail}>
                                            Confirm Booking
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
