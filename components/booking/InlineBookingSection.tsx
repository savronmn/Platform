'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import BookingFlow from '@/components/booking/BookingFlow';
import AsapBookingFlow from '@/components/booking/AsapBookingFlow';

type Mode = 'choose' | 'asap';

type InlineBookingSectionProps = {
    preselectedServiceName?: string | null;
    prefillName?: string;
    prefillEmail?: string;
    className?: string;
};

const stepTransition = { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const };

export default function InlineBookingSection({
    preselectedServiceName = null,
    prefillName,
    prefillEmail,
    className,
}: InlineBookingSectionProps) {
    const [mode, setMode] = useState<Mode>('choose');

    return (
        <section className={cn('space-y-5', className)}>
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center gap-2 text-savron-green-light">
                    <Calendar className="w-4 h-4" />
                    <p className="text-[10px] uppercase tracking-[0.35em] text-savron-silver/50">
                        Book Your Next Visit
                    </p>
                </div>
                <p className="text-savron-silver/50 text-xs max-w-md mx-auto leading-relaxed">
                    Choose your barber or grab the next available slot — your member details are pre-filled below.
                </p>
            </div>

            <div className="flex gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => setMode('choose')}
                    className={cn(
                        'flex items-center gap-1.5 flex-1 min-w-0 justify-center px-3 py-3.5 border text-xs uppercase tracking-widest transition-all duration-300 touch-manipulation select-none min-h-[48px] rounded-savron',
                        mode === 'choose'
                            ? 'border-savron-green/50 bg-savron-green/10 text-white'
                            : 'border-white/10 text-savron-silver hover:border-white/30 hover:text-white',
                    )}
                >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Choose Barber</span>
                </button>
                <button
                    type="button"
                    onClick={() => setMode('asap')}
                    className={cn(
                        'flex items-center gap-1.5 flex-1 min-w-0 justify-center px-3 py-3.5 border text-xs uppercase tracking-widest transition-all duration-300 touch-manipulation select-none min-h-[48px] rounded-savron',
                        mode === 'asap'
                            ? 'border-savron-green/50 bg-savron-green/10 text-white'
                            : 'border-white/10 text-savron-silver hover:border-white/30 hover:text-white',
                    )}
                >
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">ASAP</span>
                </button>
            </div>

            <AnimatePresence mode="wait">
                {mode === 'choose' && (
                    <motion.div
                        key="choose"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={stepTransition}
                    >
                        <BookingFlow
                            preselectedServiceName={preselectedServiceName}
                            prefillName={prefillName}
                            prefillEmail={prefillEmail}
                        />
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
                        <AsapBookingFlow
                            preselectedServiceName={preselectedServiceName}
                            prefillName={prefillName}
                            prefillEmail={prefillEmail}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
