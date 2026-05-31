"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { TIME_SLOTS } from '@/lib/services-data';
import { useServices } from '@/lib/use-services';
import { DatePicker } from './DatePicker';
import { triggerPostBooking } from '@/lib/confirm-booking';
import { isSlotInPast, nextBookableDate } from '@/lib/time-helpers';

export default function AsapBookingFlow() {
    const supabase = createClient();
    const services = useServices();
    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState<Date>(() => nextBookableDate());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<number | null>(null);
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientMessage, setClientMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [assignedBarber, setAssignedBarber] = useState<Barber | null>(null);
    const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([]);
    const [loadingBusy, setLoadingBusy] = useState(false);

    useEffect(() => {
        if (!selectedDate) return;
        // Fetch combined busy slots for all barbers (we'll use these for display only;
        // the canonical check is done per-barber inside pickAvailableBarber)
        // For simplicity, we don't pre-fetch here — isSlotBusy is only used for UI hints.
    }, [selectedDate]);

    const isSlotBusy = (timeStr: string) => {
        if (isSlotInPast(selectedDate, timeStr, 5)) return true;
        if (loadingBusy) return true;
        if (busySlots.length === 0) return false;
        const service = services.find(s => s.id === selectedService);
        const durationMin = service?.durationMin ?? 45;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const [timePart, meridiem] = timeStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        const slotStart = new Date(`${dateStr}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00-05:00`).getTime();
        const slotEnd = slotStart + durationMin * 60000;
        return busySlots.some(b => slotStart < new Date(b.end).getTime() && slotEnd > new Date(b.start).getTime());
    };

    // Find any barber who is NOT already booked at the selected date + time AND has no Google Calendar conflict
    async function pickAvailableBarber(): Promise<Barber | null> {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        const { data: allBarbers } = await supabase
            .from('barbers')
            .select('*')
            .eq('active', true)
            .order('name');

        if (!allBarbers || allBarbers.length === 0) return null;

        // 1. Filter out barbers already booked in our DB at this exact time slot
        const { data: taken } = await supabase
            .from('bookings')
            .select('barber_id')
            .eq('date', dateStr)
            .eq('time', selectedTime)
            .eq('status', 'confirmed');

        const takenIds = new Set((taken ?? []).map((b) => b.barber_id));
        const dbAvailable = allBarbers.filter((b) => !takenIds.has(b.id));

        if (dbAvailable.length === 0) return null;

        // 2. Also filter out barbers with Google Calendar conflicts
        const service = services.find(s => s.id === selectedService);
        const durationMin = service?.durationMin ?? 45;
        const [timePart, meridiem] = (selectedTime || '').split(' ');
        let [hours, minutes] = timePart?.split(':').map(Number) ?? [0, 0];
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        const slotStart = new Date(`${dateStr}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00-05:00`).getTime();
        const slotEnd = slotStart + durationMin * 60000;

        const calAvailable: Barber[] = [];
        await Promise.all(dbAvailable.map(async (barber) => {
            try {
                const res = await fetch(`/api/calendar/busy?barberId=${barber.id}&date=${dateStr}`);
                if (!res.ok) { calAvailable.push(barber); return; }
                const { busy } = await res.json() as { busy: { start: string; end: string }[] };
                const hasConflict = (busy || []).some(
                    b => slotStart < new Date(b.end).getTime() && slotEnd > new Date(b.start).getTime()
                );
                if (!hasConflict) calAvailable.push(barber);
            } catch {
                // If the API fails, assume available so booking is never blocked
                calAvailable.push(barber);
            }
        }));

        if (calAvailable.length === 0) return null;

        // Round-robin: pick random from truly available barbers
        return calAvailable[Math.floor(Math.random() * calAvailable.length)];
    }

    const handleConfirm = async () => {
        setSubmitting(true);

        const barber = await pickAvailableBarber();

        if (!barber) {
            setSubmitting(false);
            // Could show a toast — for now just alert
            alert('No barbers available at that time. Please pick another slot.');
            return;
        }

        setAssignedBarber(barber);

        const service = services.find((s) => s.id === selectedService);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');

        const { data: inserted } = await supabase.from('bookings').insert({
            client_name: clientName || null,
            client_email: clientEmail || null,
            client_phone: clientPhone || null,
            service: service?.name || '',
            barber_id: barber.id,
            barber_name: barber.name,
            date: dateStr,
            time: selectedTime,
            duration: service ? `${service.durationMin} min` : '45 min',
            price: service?.price || '',
            status: 'confirmed',
            notes: clientMessage.trim() || null,
        }).select('id').single();

        if (inserted?.id) triggerPostBooking(inserted.id);

        setSubmitting(false);
        setStep(4);
    };

    return (
        <div className="bg-savron-grey p-8 md:p-12 rounded-savron border border-white/5 min-h-[500px] flex flex-col justify-between">
            {/* Progress */}
            {step < 4 && (
                <div className="flex gap-2 mb-12">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", s <= step ? "bg-savron-green" : "bg-white/10")} />
                    ))}
                </div>
            )}

            <AnimatePresence mode="wait">
                {/* Step 1: Date + Time */}
                {step === 1 && (
                    <motion.div key="datetime" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-savron-green/20 border border-savron-green/30 rounded-savron flex items-center justify-center">
                                <Zap className="w-4 h-4 text-savron-green" />
                            </div>
                            <h2 className="text-2xl font-heading text-white uppercase tracking-wider">When do you need in?</h2>
                        </div>
                        <p className="text-savron-silver text-xs uppercase tracking-widest">We&apos;ll find the first available barber for you</p>

                        <div>
                            <p className="text-xs uppercase tracking-widest text-savron-silver/50 mb-3">Date</p>
                            <DatePicker
                                selected={selectedDate}
                                onChange={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                            />
                        </div>

                        <div>
                            <p className="text-xs uppercase tracking-widest text-savron-silver/50 mb-3">Time</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {TIME_SLOTS.map((time, idx) => {
                                    const past = isSlotInPast(selectedDate, time, 5);
                                    return (
                                        <button
                                            key={idx}
                                            disabled={past}
                                            onClick={() => !past && setSelectedTime(time)}
                                            className={cn(
                                                "p-3 border rounded-savron transition-all text-center text-sm font-mono",
                                                past
                                                    ? "opacity-30 cursor-not-allowed border-white/[0.02] line-through text-savron-silver/30"
                                                    : selectedTime === time
                                                        ? "border-savron-green bg-savron-green text-white cursor-pointer"
                                                        : "border-white/10 hover:border-white/30 text-savron-silver hover:text-white cursor-pointer"
                                            )}
                                        >
                                            {time}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Step 2: Service */}
                {step === 2 && (
                    <motion.div key="service" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                        <h2 className="text-2xl font-heading text-white uppercase tracking-wider mb-6">What do you need?</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {services.map((service) => (
                                <div
                                    key={service.id}
                                    onClick={() => setSelectedService(service.id)}
                                    className={cn(
                                        "p-4 border rounded-savron cursor-pointer transition-all flex justify-between items-center",
                                        selectedService === service.id
                                            ? "border-savron-green bg-savron-green/10"
                                            : "border-white/10 hover:border-white/30 bg-savron-black"
                                    )}
                                >
                                    <div>
                                        <h3 className="text-white font-medium uppercase tracking-wide">{service.name}</h3>
                                        <p className="text-savron-silver text-xs mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {service.duration}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-white font-mono">{service.price}</span>
                                        {selectedService === service.id && <Check className="w-4 h-4 text-emerald-400" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Details */}
                {step === 3 && (
                    <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                        <h2 className="text-2xl font-heading text-white uppercase tracking-wider">Your Details</h2>
                        <div className="bg-savron-black border border-white/10 rounded-savron p-4 space-y-2 text-sm">
                            <p className="text-savron-silver text-xs uppercase tracking-widest mb-3">Booking Summary</p>
                            <div className="flex justify-between">
                                <span className="text-savron-silver">Date</span>
                                <span className="text-white">{format(selectedDate, 'EEE, MMM d')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-savron-silver">Time</span>
                                <span className="text-white">{selectedTime}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-savron-silver">Service</span>
                                <span className="text-white">{services.find(s => s.id === selectedService)?.name}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-white/10">
                                <span className="text-savron-silver">Barber</span>
                                <span className="text-emerald-400 text-xs uppercase tracking-wider">Auto-assigned</span>
                            </div>
                        </div>
                        <input placeholder="YOUR NAME" value={clientName} onChange={e => setClientName(e.target.value)} className="input-savron" />
                        <input type="email" placeholder="YOUR EMAIL" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="input-savron" />
                        <input type="tel" placeholder="YOUR PHONE" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="input-savron" />
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
                {step === 4 && assignedBarber && (
                    <motion.div key="confirm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 py-8">
                        <div className="w-16 h-16 bg-savron-green rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-heading text-white uppercase tracking-wider">You&apos;re In</h2>
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-savron-grey border-2 border-savron-green/40 relative">
                                {assignedBarber.image_url && (
                                    <Image src={assignedBarber.image_url} alt={assignedBarber.name} fill className="object-cover" />
                                )}
                            </div>
                            <div>
                                <p className="text-white font-heading text-xl uppercase tracking-widest">{assignedBarber.name}</p>
                                <p className="text-savron-silver text-xs uppercase tracking-widest mt-1">{assignedBarber.role}</p>
                            </div>
                        </div>
                        <p className="text-savron-silver">
                            {format(selectedDate, 'EEEE, MMMM d')} at{' '}
                            <span className="text-white font-bold">{selectedTime}</span>
                        </p>
                        <p className="text-xs text-savron-silver/50 uppercase tracking-widest">Check your email for details</p>
                        <Button variant="outline" onClick={() => {
                            setStep(1); setSelectedTime(null); setSelectedService(null);
                            setSelectedDate(nextBookableDate()); setClientName(''); setClientEmail(''); setClientPhone(''); setClientMessage('');
                            setAssignedBarber(null);
                        }}>
                            Book Another
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navigation */}
            {step < 4 && (
                <div className="flex justify-between mt-12 pt-8 border-t border-white/5">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex gap-2">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                    ) : <div />}
                    <div>
                        {step === 1 && (
                            <Button onClick={() => setStep(2)} disabled={!selectedTime}>
                                Next <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                        {step === 2 && (
                            <Button onClick={() => setStep(3)} disabled={!selectedService}>
                                Next <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                        {step === 3 && (
                            <Button onClick={handleConfirm} isLoading={submitting} disabled={!clientName || !clientEmail}>
                                Find Me a Barber
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
