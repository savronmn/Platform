"use client";

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EYEBROWS_ADDON } from '@/lib/services-data';

type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    visible: boolean;
    variant?: 'default' | 'footer';
};

export function EyebrowsAddon({ checked, onChange, visible, variant = 'default' }: Props) {
    if (!visible) return null;

    if (variant === 'footer') {
        return (
            <div className="px-4 sm:px-6 py-3 border-b border-white/[0.04]">
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onChange(!checked)}
                    className={cn(
                        'w-full px-3 py-3 border rounded-savron transition-all duration-300 flex items-center justify-between gap-3 min-h-[52px] touch-manipulation text-left',
                        checked
                            ? 'border-savron-green/50 bg-savron-green/5'
                            : 'border-white/[0.08] hover:border-white/20 bg-savron-black/40',
                    )}
                    aria-pressed={checked}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className={cn(
                                'w-4 h-4 shrink-0 border rounded-sm flex items-center justify-center transition-all duration-300',
                                checked
                                    ? 'border-savron-blue-light bg-savron-blue-light/15 text-savron-blue-light'
                                    : 'border-white/25 text-transparent',
                            )}
                        >
                            <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                        <span className="text-white font-medium text-xs uppercase tracking-wide">
                            Add {EYEBROWS_ADDON.name}
                        </span>
                        <span className="text-savron-silver/50 text-xs hidden sm:inline">
                            · Brow shaping
                        </span>
                    </div>
                    <span className="text-savron-silver font-mono text-sm shrink-0">
                        +{EYEBROWS_ADDON.price}
                    </span>
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(!checked)}
            className={cn(
                'w-full px-4 py-4 border rounded-savron transition-all duration-300 flex items-center justify-between gap-4 min-h-[64px] touch-manipulation text-left',
                checked
                    ? 'border-savron-green/50 bg-savron-green/5'
                    : 'border-white/[0.08] hover:border-white/20 bg-savron-black/60',
            )}
            aria-pressed={checked}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className={cn(
                        'w-5 h-5 shrink-0 border rounded-sm flex items-center justify-center transition-all duration-300',
                        checked
                            ? 'border-savron-blue-light bg-savron-blue-light/15 text-savron-blue-light'
                            : 'border-white/25 text-transparent',
                    )}
                >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                    <p className="text-white font-medium text-sm uppercase tracking-wide">
                        Add {EYEBROWS_ADDON.name}
                    </p>
                    <p className="text-savron-silver/55 text-sm mt-0.5">
                        Brow shaping &amp; cleanup
                    </p>
                </div>
            </div>
            <span className="text-savron-silver font-mono text-sm shrink-0">
                +{EYEBROWS_ADDON.price}
            </span>
        </button>
    );
}
