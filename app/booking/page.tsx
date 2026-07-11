"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import BookingFlow from '@/components/booking/BookingFlow';
import AsapBookingFlow from '@/components/booking/AsapBookingFlow';

type Mode = 'choose' | 'asap' | null;

function BookingPageContent() {
    const searchParams = useSearchParams();
    const preselectedService = searchParams.get('service');
    const [mode, setMode] = useState<Mode>(null);

    // When arriving from a service on the homepage, default to barber-first flow
    useEffect(() => {
        if (preselectedService && mode === null) {
            setMode('choose');
        }
    }, [preselectedService, mode]);

    const stepTransition = { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const };

    return (
        <main className="min-h-screen bg-savron-black pt-20 pb-12">
            <div className="max-w-4xl w-full mx-auto px-4 sm:px-6">

                {/* Header — compact once mode selected */}
                <div className={cn("text-center transition-all duration-500", mode ? "mb-5" : "mb-8")}>
                    <h1 className={cn(
                        "font-heading uppercase tracking-widest text-white transition-all duration-500",
                        mode ? "text-2xl md:text-3xl" : "text-3xl md:text-5xl mb-3"
                    )}>
                        Book Your Appointment
                    </h1>
                    {!mode && (
                        <p className="text-savron-silver uppercase tracking-wider text-sm">
                            Choose how you&apos;d like to book
                        </p>
                    )}
                    {mode && preselectedService && (
                        <p className="text-savron-silver/70 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                            Service selected — pick your barber, then choose a time.
                        </p>
                    )}
                </div>

                {/* Mode selector — full cards before selection, compact tabs after */}
                {!mode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                        <button
                            onClick={() => setMode('choose')}
                            className="p-5 border border-white/10 hover:border-white/30 bg-savron-grey rounded-savron text-left transition-all duration-300 space-y-2 group min-h-[120px]"
                        >
                            <div className="w-10 h-10 rounded-savron bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors duration-300">
                                <User className="w-4 h-4 text-savron-silver" />
                            </div>
                            <div>
                                <h3 className="font-heading text-white uppercase tracking-widest text-base">Choose Your Barber</h3>
                                <p className="text-savron-silver text-sm mt-1.5 leading-relaxed">
                                    Browse our team, view their profiles, and pick the barber you want.
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('asap')}
                            className="p-5 border border-white/10 hover:border-white/30 bg-savron-grey rounded-savron text-left transition-all duration-300 space-y-2 group min-h-[120px]"
                        >
                            <div className="w-10 h-10 rounded-savron bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors duration-300">
                                <Zap className="w-4 h-4 text-savron-silver" />
                            </div>
                            <div>
                                <h3 className="font-heading text-white uppercase tracking-widest text-base">Get Me In ASAP</h3>
                                <p className="text-savron-silver text-sm mt-1.5 leading-relaxed">
                                    Pick your time — we&apos;ll assign the first available barber automatically.
                                </p>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2 mb-5 flex-wrap">
                        <button
                            onClick={() => setMode('choose')}
                            className={cn(
                                "flex items-center gap-1.5 flex-1 min-w-0 justify-center px-3 py-3.5 border text-xs uppercase tracking-widest transition-all duration-300 touch-manipulation select-none min-h-[48px]",
                                mode === 'choose'
                                    ? "border-savron-green/50 bg-savron-green/10 text-white"
                                    : "border-white/10 text-savron-silver hover:border-white/30 hover:text-white"
                            )}
                        >
                            <User className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Choose Barber</span>
                        </button>
                        <button
                            onClick={() => setMode('asap')}
                            className={cn(
                                "flex items-center gap-1.5 flex-1 min-w-0 justify-center px-3 py-3.5 border text-xs uppercase tracking-widest transition-all duration-300 touch-manipulation select-none min-h-[48px]",
                                mode === 'asap'
                                    ? "border-savron-green/50 bg-savron-green/10 text-white"
                                    : "border-white/10 text-savron-silver hover:border-white/30 hover:text-white"
                            )}
                        >
                            <Zap className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">ASAP</span>
                        </button>
                    </div>
                )}

                {/* Booking flows */}
                <AnimatePresence mode="wait">
                    {mode === 'choose' && (
                        <motion.div
                            key="choose"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={stepTransition}
                        >
                            <BookingFlow preselectedServiceName={preselectedService} />
                        </motion.div>
                    )}
                    {mode === 'asap' && (
                        <motion.div
                            key="asap"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={stepTransition}
                        >
                            <AsapBookingFlow preselectedServiceName={preselectedService} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}

export default function BookingPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-savron-black pt-20 pb-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </main>
        }>
            <BookingPageContent />
        </Suspense>
    );
}
