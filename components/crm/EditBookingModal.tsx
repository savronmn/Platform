"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useServices } from '@/lib/use-services';
import { TIME_SLOTS, generateTimeSlots } from '@/lib/services-data';
import type { Barber, Booking } from '@/lib/types';

interface EditBookingModalProps {
    booking: Booking | null;
    barbers: Barber[];
    onClose: () => void;
    onSaved: (updated: Booking) => void;
}

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export default function EditBookingModal({ booking, barbers, onClose, onSaved }: EditBookingModalProps) {
    const supabase = createClient();
    const services = useServices();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        service: '',
        barberId: '',
        date: '',
        time: '',
        notes: '',
    });

    // Populate form from booking whenever it changes
    useEffect(() => {
        if (!booking) return;
        setError(null);
        setForm({
            clientName: booking.client_name ?? '',
            clientPhone: booking.client_phone ?? '',
            clientEmail: booking.client_email ?? '',
            service: booking.service ?? '',
            barberId: booking.barber_id ?? '',
            date: booking.date ?? '',
            time: booking.time ?? '',
            notes: booking.notes ?? '',
        });
    }, [booking]);

    const field = (k: keyof typeof form, v: string) => {
        setForm(f => {
            const next = { ...f, [k]: v };
            if (k === 'barberId' || k === 'date') next.time = '';
            return next;
        });
    };

    const availableSlots = (() => {
        const barber = barbers.find(b => b.id === form.barberId);
        if (!barber?.working_hours || !form.date) return TIME_SLOTS;
        const dayIndex = new Date(`${form.date}T12:00:00`).getDay();
        const dayKey = DAY_KEYS[dayIndex];
        const daySchedule = (barber.working_hours as Record<string, { open: string; close: string } | null>)[dayKey];
        if (!daySchedule) return [];
        return generateTimeSlots(daySchedule.open, daySchedule.close);
    })();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!booking) return;
        if (!form.service || !form.barberId || !form.time || !form.date) {
            setError('Service, barber, date, and time are required.');
            return;
        }
        setSubmitting(true);
        setError(null);

        const barber = barbers.find(b => b.id === form.barberId);
        const selectedService = services.find(s => s.name === form.service);

        const { data, error: updateError } = await supabase
            .from('bookings')
            .update({
                client_name: form.clientName.trim() || 'Walk-in',
                client_phone: form.clientPhone.trim() || null,
                client_email: form.clientEmail.trim() || null,
                service: form.service,
                barber_id: form.barberId,
                barber_name: barber?.name ?? booking.barber_name,
                date: form.date,
                time: form.time,
                duration: selectedService?.duration ?? booking.duration,
                price: selectedService?.price ?? booking.price,
                notes: form.notes.trim() || null,
            })
            .eq('id', booking.id)
            .select()
            .single();

        setSubmitting(false);
        if (updateError) { setError(updateError.message); return; }
        onSaved(data as Booking);
        onClose();
    }

    return (
        <AnimatePresence>
            {booking && (
                <motion.div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
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
                                <Pencil className="w-4 h-4 text-savron-green" />
                                <span className="font-heading text-sm uppercase tracking-widest text-white">Edit Appointment</span>
                            </div>
                            <button onClick={onClose} className="text-savron-silver hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Client info */}
                            <div>
                                <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Client Name</label>
                                <input
                                    type="text"
                                    value={form.clientName}
                                    onChange={e => field('clientName', e.target.value)}
                                    placeholder="Walk-in"
                                    className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-savron-green/50 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={form.clientPhone}
                                        onChange={e => field('clientPhone', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-savron-green/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={form.clientEmail}
                                        onChange={e => field('clientEmail', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-savron-green/50 transition-colors"
                                    />
                                </div>
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
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Date <span className="text-savron-green">*</span></label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => field('date', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white focus:outline-none focus:border-savron-green/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Time <span className="text-savron-green">*</span></label>
                                    <select
                                        value={form.time}
                                        onChange={e => field('time', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white focus:outline-none focus:border-savron-green/50 transition-colors appearance-none"
                                    >
                                        <option value="" className="bg-savron-grey">
                                            {availableSlots.length === 0 && form.barberId ? 'Barber off this day' : 'Select…'}
                                        </option>
                                        {availableSlots.map(t => (
                                            <option key={t} value={t} className="bg-savron-grey">{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs uppercase tracking-widest text-savron-silver mb-1">Notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => field('notes', e.target.value)}
                                    rows={2}
                                    className="w-full bg-white/5 border border-white/10 rounded-savron px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-savron-green/50 transition-colors resize-none"
                                />
                            </div>

                            {error && <p className="text-red-400 text-xs">{error}</p>}

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
                                    {submitting ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
