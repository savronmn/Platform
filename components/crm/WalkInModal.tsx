"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useServices } from '@/lib/use-services';
import { TIME_SLOTS, BOOKING_SLOT_INTERVAL_MINS, generateTimeSlots } from '@/lib/services-data';
import type { Barber } from '@/lib/types';
import { triggerPostBooking } from '@/lib/confirm-booking';
import { isSlotInPast, slotConflictsWithBusy } from '@/lib/time-helpers';

interface WalkInModalProps {
    open: boolean;
    onClose: () => void;
    onBooked?: () => void;
}

export default function WalkInModal({ open, onClose, onBooked }: WalkInModalProps) {
    const supabase = createClient();
    const services = useServices();
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([]);
    const [loadingBusy, setLoadingBusy] = useState(false);

    const [form, setForm] = useState({
        clientName: '',
        service: '',
        barberId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '',
    });

    useEffect(() => {
        if (!open) return;
        setSuccess(false);
        setError(null);
        setForm({
            clientName: '',
            service: '',
            barberId: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            time: '',
        });
        supabase.from('barbers').select('id, name, active, working_hours').eq('active', true).then(({ data }) => {
            setBarbers((data as Barber[]) ?? []);
        });
    }, [open]);

    const field = (k: keyof typeof form, v: string) => {
        setForm(f => {
            const next = { ...f, [k]: v };
            if (k === 'barberId' || k === 'date' || k === 'service') next.time = '';
            return next;
        });
    };

    const selectedService = services.find(s => s.name === form.service);
    const durationMin = selectedService?.durationMin ?? 45;
    const selectedDate = form.date ? new Date(`${form.date}T12:00:00`) : new Date();

    useEffect(() => {
        if (!open || !form.barberId || !form.date) {
            setBusySlots([]);
            return;
        }
        let cancelled = false;
        async function fetchBusy() {
            setLoadingBusy(true);
            try {
                const res = await fetch(`/api/calendar/busy?barberId=${form.barberId}&date=${form.date}`);
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled) setBusySlots(data.busy || []);
                } else if (!cancelled) {
                    setBusySlots([]);
                }
            } catch {
                if (!cancelled) setBusySlots([]);
            }
            if (!cancelled) setLoadingBusy(false);
        }
        fetchBusy();
        return () => { cancelled = true; };
    }, [open, form.barberId, form.date]);

    const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

    const workingHoursSlots = (() => {
        const barber = barbers.find(b => b.id === form.barberId);
        if (!barber?.working_hours || !form.date) return TIME_SLOTS;
        const dayIndex = new Date(`${form.date}T12:00:00`).getDay();
        const dayKey = DAY_KEYS[dayIndex];
        const daySchedule = (barber.working_hours as Record<string, { open: string; close: string } | null>)[dayKey];
        if (!daySchedule) return [];
        return generateTimeSlots(daySchedule.open, daySchedule.close, BOOKING_SLOT_INTERVAL_MINS);
    })();

    const isSlotUnavailable = (timeStr: string) => {
        if (isSlotInPast(selectedDate, timeStr, 0)) return true;
        if (loadingBusy) return true;
        return slotConflictsWithBusy(selectedDate, timeStr, durationMin, busySlots);
    };

    const availableSlots = workingHoursSlots.filter(t => !isSlotUnavailable(t));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.service || !form.barberId || !form.time) {
            setError('Service, barber, and time are required.');
            return;
        }
        setSubmitting(true);
        setError(null);
        const barber = barbers.find(b => b.id === form.barberId);

        if (isSlotUnavailable(form.time)) {
            setSubmitting(false);
            setError('That slot is no longer available. Please choose a different time.');
            return;
        }

        const { data: conflictCheck } = await supabase
            .from('bookings')
            .select('id')
            .eq('barber_id', form.barberId)
            .eq('date', form.date)
            .eq('time', form.time)
            .in('status', ['confirmed', 'completed', 'no_show'])
            .limit(1);
        if (conflictCheck && conflictCheck.length > 0) {
            setSubmitting(false);
            setError('That slot is already booked. Please choose a different time.');
            return;
        }

        const { data: inserted, error: insertError } = await supabase.from('bookings').insert({
            client_name: form.clientName.trim() || 'Walk-in',
            service: form.service,
            barber_id: form.barberId,
            barber_name: barber?.name ?? '',
            date: form.date,
            time: form.time,
            duration: selectedService ? selectedService.duration : '45 min',
            price: selectedService ? selectedService.price : '',
            status: 'confirmed',
        }).select('id').single();
        setSubmitting(false);
        if (insertError) {
            if (insertError.code === '23505') {
                setError('That slot is already booked. Please choose a different time.');
            } else {
                setError(insertError.message);
            }
            return;
        }
        if (inserted?.id) triggerPostBooking(inserted.id);
        setSuccess(true);
        onBooked?.();
        setTimeout(() => { onClose(); }, 1400);
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    <motion.div
                        className="w-full max-w-md bg-savron-grey border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-savron-green" />
                                <span className="font-heading text-sm uppercase tracking-widest text-white">Walk-in</span>
                            </div>
                            <button onClick={onClose} className="text-savron-silver hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {success ? (
                            <div className="px-6 py-10 text-center space-y-2">
                                <div className="text-savron-green text-3xl">✓</div>
                                <p className="text-white font-heading uppercase tracking-widest text-sm">Booked</p>
                                <p className="text-savron-silver text-xs">{form.clientName.trim() || 'Walk-in'} added to today&apos;s schedule</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                                {/* Client name */}
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        placeholder="Leave blank for Walk-in"
                                        value={form.clientName}
                                        onChange={e => field('clientName', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-savron-green/50 transition-colors"
                                    />
                                </div>

                                {/* Service */}
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Service <span className="text-savron-green">*</span></label>
                                    <select
                                        value={form.service}
                                        onChange={e => field('service', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white focus:outline-none focus:border-savron-green/50 transition-colors appearance-none"
                                    >
                                        <option value="" className="bg-savron-grey">Select service…</option>
                                        {services.map(s => (
                                            <option key={s.name} value={s.name} className="bg-savron-grey">{s.name} — {s.price}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Barber */}
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Barber <span className="text-savron-green">*</span></label>
                                    <select
                                        value={form.barberId}
                                        onChange={e => field('barberId', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white focus:outline-none focus:border-savron-green/50 transition-colors appearance-none"
                                    >
                                        <option value="" className="bg-savron-grey">Select barber…</option>
                                        {barbers.map(b => (
                                            <option key={b.id} value={b.id} className="bg-savron-grey">{b.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date + Time */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Date</label>
                                        <input
                                            type="date"
                                            value={form.date}
                                            onChange={e => field('date', e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white focus:outline-none focus:border-savron-green/50 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Time <span className="text-savron-green">*</span></label>
                                        {!form.barberId ? (
                                            <p className="text-savron-silver/50 text-xs py-2">Select a barber first.</p>
                                        ) : loadingBusy ? (
                                            <p className="text-savron-silver/50 text-xs py-2">Loading availability…</p>
                                        ) : (
                                            <select
                                                value={form.time}
                                                onChange={e => field('time', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white focus:outline-none focus:border-savron-green/50 transition-colors appearance-none"
                                            >
                                                <option value="" className="bg-savron-grey">
                                                    {workingHoursSlots.length === 0
                                                        ? 'Barber off this day'
                                                        : availableSlots.length === 0
                                                            ? 'No available slots'
                                                            : 'Select…'}
                                                </option>
                                                {availableSlots.map(t => (
                                                    <option key={t} value={t} className="bg-savron-grey">{t}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {error && (
                                    <p className="text-red-400 text-xs">{error}</p>
                                )}

                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 px-4 py-2 text-xs uppercase tracking-widest text-savron-silver border border-white/10 rounded-savron hover:border-white/20 hover:text-white transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className={cn(
                                            "flex-1 px-4 py-2 text-xs uppercase tracking-widest rounded-savron transition-all",
                                            "bg-savron-green text-white border border-savron-green-light/20 hover:bg-savron-green-light",
                                            submitting && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        {submitting ? 'Booking…' : 'Add Walk-in'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
