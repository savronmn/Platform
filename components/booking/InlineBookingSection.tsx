'use client';

import { Suspense } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import AsapBookingFlow from '@/components/booking/AsapBookingFlow';
// import BarberChooser from '@/components/booking/BarberChooser';
// ↑ Re-enable when adding the "choose your barber" step back

type InlineBookingSectionProps = {
    preselectedServiceName?: string | null;
    prefillName?: string;
    prefillEmail?: string;
    className?: string;
};

export default function InlineBookingSection({
    preselectedServiceName = null,
    prefillName,
    prefillEmail,
    className,
}: InlineBookingSectionProps) {
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
                    Pick a time with Albe.
                </p>
            </div>

            <Suspense fallback={
                <div className="bg-savron-grey p-8 rounded-savron border border-white/5 flex items-center justify-center min-h-[200px]">
                    <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                </div>
            }>
                <AsapBookingFlow
                    preselectedServiceName={preselectedServiceName}
                    prefillName={prefillName}
                    prefillEmail={prefillEmail}
                />
            </Suspense>

            {/*
              ── Barber chooser step (disabled — restore when ready) ──
              <BarberChooser
                  preselectedServiceName={preselectedServiceName}
                  prefillName={prefillName}
                  prefillEmail={prefillEmail}
                  compact
              />
            */}
        </section>
    );
}
