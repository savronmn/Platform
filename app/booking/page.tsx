"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import BookingFlow from '@/components/booking/BookingFlow';
import AsapBookingFlow from '@/components/booking/AsapBookingFlow';

type Mode = 'choose' | 'asap' | null;

export default function BookingPage() {
    const [mode, setMode] = useState<Mode>(null);

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
                        <p className="text-savron-silver uppercase tracking-wider text-xs">
                            Choose how you&apos;d like to book
                        </p>
                    )}
                </div>

                {/* Mode selector — full cards before selection, compact tabs after */}
                {!mode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                        <button
                            onClick={() => setMode('choose')}
                            className="p-5 border border-white/10 hover:border-white/30 bg-savron-grey rounded-savron text-left transition-all space-y-2 group"
                        >
                            <div className="w-9 h-9 rounded-savron bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
                                <User className="w-4 h-4 text-savron-silver" />
                            </div>
                            <div>
                                <h3 className="font-heading text-white uppercase tracking-widest text-base">Choose Your Barber</h3>
                                <p className="text-savron-silver text-xs mt-1 leading-relaxed">
                                    Browse our team, view their profiles, and pick the barber you want.
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('asap')}
                            className="p-5 border border-white/10 hover:border-white/30 bg-savron-grey rounded-savron text-left transition-all space-y-2 group"
                        >
                            <div className="w-9 h-9 rounded-savron bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
                                <Zap className="w-4 h-4 text-savron-silver" />
                            </div>
                            <div>
                                <h3 className="font-heading text-white uppercase tracking-widest text-base">Get Me In ASAP</h3>
                                <p className="text-savron-silver text-xs mt-1 leading-relaxed">
                                    Pick your time and service — we&apos;ll assign the first available barber automatically.
                                </p>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2 mb-5 flex-wrap">
                        <button
                            onClick={() => setMode('choose')}
                            className={cn(
                                "flex items-center gap-1.5 flex-1 min-w-0 justify-center px-3 py-3 border text-[10px] sm:text-xs uppercase tracking-widest transition-all touch-manipulation select-none",
                                mode === 'choose'
                                    ? "border-savron-green/50 bg-savron-green/10 text-white"
                                    : "border-white/10 text-savron-silver hover:border-white/30 hover:text-white"
                            )}
                        >
                            <User className="w-3 h-3 shrink-0" /> <span className="truncate">Choose Barber</span>
                        </button>
                        <button
                            onClick={() => setMode('asap')}
                            className={cn(
                                "flex items-center gap-1.5 flex-1 min-w-0 justify-center px-3 py-3 border text-[10px] sm:text-xs uppercase tracking-widest transition-all touch-manipulation select-none",
                                mode === 'asap'
                                    ? "border-savron-green/50 bg-savron-green/10 text-white"
                                    : "border-white/10 text-savron-silver hover:border-white/30 hover:text-white"
                            )}
                        >
                            <Zap className="w-3 h-3 shrink-0" /> <span className="truncate">ASAP</span>
                        </button>
                    </div>
                )}

                {/* Booking flows */}
                <AnimatePresence mode="wait">
                    {mode === 'choose' && (
                        <motion.div
                            key="choose"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <BookingFlow />
                        </motion.div>
                    )}
                    {mode === 'asap' && (
                        <motion.div
                            key="asap"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <AsapBookingFlow />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
