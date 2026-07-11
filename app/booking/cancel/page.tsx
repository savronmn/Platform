"use client";

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, Loader2, Scissors, User, XCircle } from 'lucide-react';

interface CancelPreview {
    id: string;
    service: string;
    date: string;
    time: string;
    status: string;
    clientFirstName: string | null;
    barberName: string;
}

type PageState = 'loading' | 'invalid' | 'ready' | 'cancelling' | 'done' | 'already';

function CancelBookingContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [state, setState] = useState<PageState>('loading');
    const [booking, setBooking] = useState<CancelPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const loadPreview = useCallback(async () => {
        if (!token) {
            setState('invalid');
            setError('This cancel link is missing or invalid.');
            return;
        }

        setState('loading');
        setError(null);

        try {
            const res = await fetch(`/api/bookings/cancel-link?token=${encodeURIComponent(token)}`);
            const data = await res.json();
            if (!res.ok) {
                setState('invalid');
                setError(data.error ?? 'This cancel link is invalid or has expired.');
                return;
            }

            setBooking(data.booking);
            if (data.alreadyCancelled) {
                setState('already');
            } else if (data.canCancel) {
                setState('ready');
            } else {
                setState('invalid');
                setError('This appointment can no longer be cancelled online.');
            }
        } catch {
            setState('invalid');
            setError('Could not load your appointment. Please try again or email us.');
        }
    }, [token]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    const handleCancel = async () => {
        if (!token || !booking) return;
        if (!confirm(`Cancel your ${booking.service} on ${booking.date} at ${booking.time}?`)) return;

        setState('cancelling');
        setError(null);
        setWarning(null);

        try {
            const res = await fetch('/api/bookings/cancel-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!res.ok) {
                setState('ready');
                setError(data.error ?? 'Cancellation failed. Please email us.');
                return;
            }
            setWarning(data.warning ?? null);
            setState(data.alreadyCancelled ? 'already' : 'done');
        } catch {
            setState('ready');
            setError('Network error. Please try again or email us.');
        }
    };

    const dateFormatted = booking
        ? (() => {
            try { return format(new Date(`${booking.date}T12:00:00`), 'EEEE, MMMM d, yyyy'); }
            catch { return booking.date; }
        })()
        : '';

    return (
        <main className="min-h-screen bg-savron-black pt-20 pb-12 px-4 sm:px-6">
            <div className="max-w-lg mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center text-[10px] uppercase tracking-[0.3em] text-savron-silver/50 hover:text-white transition-colors mb-8"
                >
                    <ChevronLeft className="w-3 h-3 mr-2" />
                    Back to Home
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-white/10 bg-[#121212] p-6 sm:p-8 space-y-6"
                >
                    <div className="text-center space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-savron-silver/50">SAVRON</p>
                        <h1 className="font-heading text-2xl sm:text-3xl text-white uppercase tracking-wider">
                            {state === 'done' || state === 'already' ? 'Appointment Cancelled' : 'Cancel Appointment'}
                        </h1>
                    </div>

                    {state === 'loading' && (
                        <div className="flex items-center justify-center gap-3 py-10 text-savron-silver/70 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading your appointment…
                        </div>
                    )}

                    {state === 'invalid' && (
                        <div className="space-y-4 text-center py-4">
                            <XCircle className="w-10 h-10 text-red-400/80 mx-auto" />
                            <p className="text-savron-silver/80 text-sm leading-relaxed">{error}</p>
                            <Link
                                href="/booking"
                                className="inline-block bg-[#125470] px-6 py-3 text-[11px] uppercase tracking-[0.25em] text-white font-semibold"
                            >
                                Book Again
                            </Link>
                        </div>
                    )}

                    {(state === 'ready' || state === 'cancelling' || state === 'done' || state === 'already') && booking && (
                        <div className="space-y-5">
                            {(state === 'done' || state === 'already') ? (
                                <p className="text-savron-silver/80 text-sm text-center leading-relaxed">
                                    {state === 'already'
                                        ? 'This appointment was already cancelled.'
                                        : `${booking.clientFirstName ? `${booking.clientFirstName}, your` : 'Your'} ${booking.service} appointment has been cancelled. We've sent a confirmation email.`}
                                </p>
                            ) : (
                                <p className="text-savron-silver/70 text-sm text-center">
                                    {booking.clientFirstName ? `Hi ${booking.clientFirstName}, ` : ''}
                                    confirm you'd like to cancel this appointment:
                                </p>
                            )}

                            <div className="bg-black/40 border border-white/5 divide-y divide-white/5">
                                <div className="flex items-start gap-3 p-4">
                                    <Scissors className="w-4 h-4 text-[#1A6A8A] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/40">Service</p>
                                        <p className="text-white text-sm">{booking.service}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4">
                                    <User className="w-4 h-4 text-[#1A6A8A] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/40">Barber</p>
                                        <p className="text-white text-sm">{booking.barberName}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4">
                                    <Calendar className="w-4 h-4 text-[#1A6A8A] mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/40">When</p>
                                        <p className="text-white text-sm">{dateFormatted}</p>
                                        <p className="text-savron-silver/70 text-sm">{booking.time}</p>
                                    </div>
                                </div>
                            </div>

                            {error && state === 'ready' && (
                                <p className="text-red-400/90 text-sm text-center">{error}</p>
                            )}
                            {warning && (
                                <p className="text-amber-300/80 text-xs text-center leading-relaxed">{warning}</p>
                            )}

                            {state === 'ready' && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="w-full bg-red-900/80 hover:bg-red-800 border border-red-700/50 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white font-semibold transition-colors"
                                >
                                    Cancel This Appointment
                                </button>
                            )}

                            {state === 'cancelling' && (
                                <div className="flex items-center justify-center gap-2 py-3 text-savron-silver/70 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Cancelling…
                                </div>
                            )}

                            {(state === 'done' || state === 'already') && (
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <Link
                                        href="/booking"
                                        className="flex-1 text-center bg-[#125470] py-3 text-[11px] uppercase tracking-[0.25em] text-white font-semibold"
                                    >
                                        Book Again
                                    </Link>
                                    <Link
                                        href="/"
                                        className="flex-1 text-center border border-white/15 py-3 text-[11px] uppercase tracking-[0.25em] text-savron-silver/80"
                                    >
                                        Home
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </main>
    );
}

export default function CancelBookingPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-savron-black flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-savron-silver/50" />
            </main>
        }>
            <CancelBookingContent />
        </Suspense>
    );
}
