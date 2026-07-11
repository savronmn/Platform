"use client";

import { Clock } from 'lucide-react';
import type { ServiceItem } from '@/lib/services-data';

type Props = {
    service: ServiceItem;
    onChange?: () => void;
};

export function SelectedServiceBanner({ service, onChange }: Props) {
    return (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-savron border border-savron-green/25 bg-savron-green/5 px-4 py-3">
            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 mb-1">Your service</p>
                <p className="text-white font-medium text-sm uppercase tracking-wide truncate">{service.name}</p>
                <p className="text-savron-silver/60 text-xs mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    {service.duration} · {service.price}
                </p>
            </div>
            {onChange && (
                <button
                    type="button"
                    onClick={onChange}
                    className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-savron-silver/70 hover:text-white transition-colors px-3 py-2 min-h-[44px] touch-manipulation"
                >
                    Change
                </button>
            )}
        </div>
    );
}
