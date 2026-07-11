"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EYEBROWS_ADDON } from '@/lib/services-data';

type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    visible: boolean;
};

export function EyebrowsAddon({ checked, onChange, visible }: Props) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                >
                    <button
                        type="button"
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
                                        ? 'border-emerald-400 bg-emerald-400/15 text-emerald-400'
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
                </motion.div>
            )}
        </AnimatePresence>
    );
}
