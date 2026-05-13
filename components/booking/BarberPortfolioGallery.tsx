"use client";

// Mobile: renders inside a bottom-sheet modal.
// Desktop: overlays as a hover fade-in panel positioned relative to the card.
// Usage: <BarberPortfolioGallery images={...} name={...} mode="modal" open onClose={() => ...} />
//        <BarberPortfolioGallery images={...} name={...} mode="hover" />

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    images: string[];
    name: string;
    mode: 'modal' | 'hover';
    open?: boolean;
    onClose?: () => void;
}

export default function BarberPortfolioGallery({ images, name, mode, open = false, onClose }: Props) {
    const [idx, setIdx] = useState(0);
    if (!images || images.length === 0) return null;

    const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); };
    const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); };

    // ── MODAL (mobile tap) ──────────────────────────────────────────────────
    if (mode === 'modal') {
        return (
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-50 flex flex-col"
                        onClick={onClose}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 shrink-0" onClick={e => e.stopPropagation()}>
                            <p className="font-heading uppercase tracking-widest text-white text-sm">{name} — Portfolio</p>
                            <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Image */}
                        <div className="flex-1 relative mx-4 mb-4 rounded-savron overflow-hidden" onClick={e => e.stopPropagation()}>
                            <Image
                                src={images[idx]}
                                alt={`${name} work ${idx + 1}`}
                                fill
                                className="object-cover"
                                sizes="100vw"
                            />

                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={prev}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={next}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>

                                    {/* Dots */}
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                                        {images.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={e => { e.stopPropagation(); setIdx(i); }}
                                                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white' : 'bg-white/30'}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Thumbnail strip */}
                        {images.length > 1 && (
                            <div className="flex gap-2 px-4 pb-5 shrink-0 overflow-x-auto" onClick={e => e.stopPropagation()}>
                                {images.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setIdx(i)}
                                        className={`w-16 h-16 shrink-0 rounded-savron overflow-hidden border-2 transition-all ${i === idx ? 'border-white' : 'border-transparent opacity-60 hover:opacity-80'}`}
                                    >
                                        <div className="relative w-full h-full">
                                            <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    // ── HOVER overlay (desktop) ─────────────────────────────────────────────
    // Positioned absolute inside a relative parent. Cycles images every 600ms on hover.
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 rounded-savron overflow-hidden pointer-events-none"
        >
            <div className="relative w-full h-full">
                <Image
                    src={images[idx]}
                    alt={`${name} portfolio`}
                    fill
                    className="object-cover"
                    sizes="200px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                    <div className="flex gap-0.5 justify-center">
                        {images.slice(0, 5).map((_, i) => (
                            <div key={i} className={`h-0.5 flex-1 rounded-full transition-all ${i === idx % images.length ? 'bg-white' : 'bg-white/30'}`} />
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
