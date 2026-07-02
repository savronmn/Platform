"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QRScannerModalProps {
    open: boolean;
    onClose: () => void;
    onScanSuccess?: (subscriber: ScannedSubscriber) => void;
}

type ScanState = 'scanning' | 'loading' | 'success' | 'error';

interface ScannedSubscriber {
    id: string;
    name: string;
    email: string;
    visit_count: number;
    last_visit_at?: string;
}

function getTier(visits: number): { label: string; color: string } {
    if (visits >= 25) return { label: 'VIP', color: 'text-yellow-400' };
    if (visits >= 10) return { label: 'Inner Circle', color: 'text-blue-400' };
    return { label: 'Standard', color: 'text-savron-silver' };
}

export default function QRScannerModal({ open, onClose, onScanSuccess }: QRScannerModalProps) {
    const [scanState, setScanState] = useState<ScanState>('scanning');
    const [subscriber, setSubscriber] = useState<ScannedSubscriber | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null);
    const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch {/* already stopped */}
            scannerRef.current = null;
        }
    };

    const startScanner = async () => {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('qr-reader-element');
        scannerRef.current = scanner;

        try {
            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: (width, height) => {
                        const min = Math.min(width, height);
                        const size = Math.floor(min * 0.7);
                        return { width: size, height: size };
                    }
                },
                async (decodedText) => {
                    await stopScanner();
                    setScanState('loading');
                    try {
                        const res = await fetch('/api/wallet/scan-checkin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ qrValue: decodedText }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                            setSubscriber(data.subscriber);
                            setScanState('success');
                            onScanSuccess?.(data.subscriber);
                            autoResetRef.current = setTimeout(() => resetToScan(), 5000);
                        } else {
                            setErrorMsg(data.error || 'Pass not found');
                            setScanState('error');
                        }
                    } catch (err) {
                        setErrorMsg('Network error — try again');
                        setScanState('error');
                    }
                },
                undefined
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
                setErrorMsg('Camera access denied. Allow camera permission in your browser.');
            } else {
                setErrorMsg('Could not start camera. Try again.');
            }
            setScanState('error');
        }
    };

    const resetToScan = async () => {
        if (autoResetRef.current) clearTimeout(autoResetRef.current);
        setSubscriber(null);
        setErrorMsg(null);
        setScanState('scanning');
    };

    useEffect(() => {
        if (open && scanState === 'scanning') {
            const timer = setTimeout(() => startScanner(), 100);
            return () => clearTimeout(timer);
        }
    }, [open, scanState]);

    useEffect(() => {
        if (!open) {
            if (autoResetRef.current) clearTimeout(autoResetRef.current);
            stopScanner();
            setScanState('scanning');
            setSubscriber(null);
            setErrorMsg(null);
        }
    }, [open]);

    useEffect(() => {
        return () => {
            if (autoResetRef.current) clearTimeout(autoResetRef.current);
            stopScanner();
        };
    }, []);

    const tier = subscriber ? getTier(subscriber.visit_count) : null;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-sm shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <ScanLine className="w-4 h-4 text-accent-blue" />
                                <h3 className="font-heading text-white uppercase tracking-wider text-sm">Scan ePass</h3>
                            </div>
                            <button
                                onClick={() => { stopScanner(); onClose(); }}
                                className="text-savron-silver hover:text-white transition-colors p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5">
                            {/* Scanning state */}
                            {scanState === 'scanning' && (
                                <div className="space-y-4">
                                    <div
                                        id="qr-reader-element"
                                        className="w-full aspect-square overflow-hidden rounded-savron ring-2 ring-savron-green/40 bg-savron-black"
                                    />
                                    <p className="text-center text-[10px] uppercase tracking-widest text-savron-silver/50">
                                        Hold pass QR code up to camera
                                    </p>
                                </div>
                            )}

                            {/* Loading state */}
                            {scanState === 'loading' && (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <div className="w-8 h-8 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/50">Verifying pass…</p>
                                </div>
                            )}

                            {/* Success state */}
                            {scanState === 'success' && subscriber && tier && (
                                <div className="space-y-5">
                                    <div className="flex flex-col items-center py-4 gap-3">
                                        <CheckCircle className="w-10 h-10 text-accent-blue" />
                                        <div className="text-center">
                                            <p className="text-white font-heading text-2xl uppercase tracking-wider">{subscriber.name}</p>
                                            <p className={cn("text-xs uppercase tracking-widest mt-1", tier.color)}>{tier.label}</p>
                                        </div>
                                        <div className="bg-savron-charcoal border border-white/10 rounded-savron px-8 py-4 text-center">
                                            <p className="text-accent-blue font-mono text-4xl font-bold">{subscriber.visit_count}</p>
                                            <p className="text-savron-silver/50 text-[10px] uppercase tracking-widest mt-1">
                                                Visit{subscriber.visit_count !== 1 ? 's' : ''} total
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={resetToScan}
                                        className="w-full py-3 text-[11px] uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 hover:bg-savron-green-light rounded-savron transition-all"
                                    >
                                        Scan Next
                                    </button>
                                </div>
                            )}

                            {/* Error state */}
                            {scanState === 'error' && (
                                <div className="space-y-5">
                                    <div className="flex flex-col items-center py-6 gap-3">
                                        <AlertTriangle className="w-10 h-10 text-red-400" />
                                        <p className="text-center text-white text-sm font-medium">
                                            {errorMsg ?? 'Something went wrong'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={resetToScan}
                                        className="w-full py-3 text-[11px] uppercase tracking-widest bg-white/5 text-savron-silver border border-white/10 rounded-savron hover:text-white hover:border-white/20 transition-all"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
