'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import BarberChooser from '@/components/booking/BarberChooser';

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
                    Choose your barber, view their profile and services, then book your appointment.
                </p>
            </div>

            <BarberChooser
                preselectedServiceName={preselectedServiceName}
                prefillName={prefillName}
                prefillEmail={prefillEmail}
                compact
            />
        </section>
    );
}
