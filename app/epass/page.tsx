"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Shield, QrCode, LogOut, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase';
import { SHOP_ADDRESS, SHOP_MAPS_URL } from '@/lib/shop';

type PageState = 'email' | 'otp' | 'profile' | 'not_found';

interface Subscriber {
    name: string;
    email: string;
    visit_count: number;
    last_visit_at: string | null;
    issued_at: string;
}

const TIER_CONFIG = {
    standard:     { label: 'Standard Member',  color: 'text-savron-silver',  border: 'border-savron-silver/30',  min: 0,  max: 9  },
    inner_circle: { label: 'Inner Circle',      color: 'text-blue-400',       border: 'border-blue-400/30',       min: 10, max: 24 },
    vip:          { label: 'VIP Member',        color: 'text-yellow-400',     border: 'border-yellow-400/30',     min: 25, max: Infinity },
};

function getTier(visits: number) {
    if (visits >= 25) return TIER_CONFIG.vip;
    if (visits >= 10) return TIER_CONFIG.inner_circle;
    return TIER_CONFIG.standard;
}

const SESSION_KEY = 'epass_email';

export default function EPassPage() {
    const [pageState, setPageState] = useState<PageState>('email');
    const [email, setEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const supabase = createClient();

    // Restore session from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
            setEmail(saved);
            loadProfile(saved);
        }
    }, []);

    // Live updates when a barber scans this pass (broadcast + polling fallback)
    useEffect(() => {
        if (pageState !== 'profile' || !subscriber?.email) return;

        const normalizedEmail = subscriber.email.trim().toLowerCase();

        const applyVisitUpdate = (visit_count: number, last_visit_at: string | null) => {
            setSubscriber(prev => prev ? { ...prev, visit_count, last_visit_at } : prev);
            void syncGoogleWallet(normalizedEmail);
        };

        const channel = supabase
            .channel(`epass:${normalizedEmail}`)
            .on('broadcast', { event: 'visit_update' }, ({ payload }) => {
                const data = payload as { visit_count?: number; last_visit_at?: string | null };
                if (typeof data.visit_count === 'number') {
                    applyVisitUpdate(data.visit_count, data.last_visit_at ?? null);
                }
            })
            .subscribe();

        const refresh = () => {
            if (document.visibilityState === 'visible') {
                loadProfile(normalizedEmail, { quiet: true });
            }
        };

        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);

        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadProfile(normalizedEmail, { quiet: true });
            }
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
            clearInterval(interval);
        };
    }, [pageState, subscriber?.email]);

    async function syncGoogleWallet(userEmail: string) {
        try {
            await fetch('/api/wallet/sync-google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail }),
            });
        } catch {
            // Non-fatal — web pass still shows live DB data
        }
    }

    async function loadProfile(userEmail: string, options?: { quiet?: boolean }) {
        if (!options?.quiet) setLoading(true);
        try {
            const QRCode = (await import('qrcode')).default;
            const res = await fetch('/api/epass/verify-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: userEmail }),
            });
            const data = await res.json();
            if (res.ok && data.subscriber) {
                setSubscriber(data.subscriber);
                const url = await QRCode.toDataURL(data.subscriber.email, {
                    width: 240,
                    margin: 2,
                    color: { dark: '#FFFFFF', light: '#0e0e0e' },
                });
                setQrDataUrl(url);
                setPageState('profile');
                void syncGoogleWallet(userEmail);
            } else {
                localStorage.removeItem(SESSION_KEY);
                setPageState('email');
            }
        } catch {
            localStorage.removeItem(SESSION_KEY);
            setPageState('email');
        } finally {
            if (!options?.quiet) setLoading(false);
        }
    }

    async function sendOtp() {
        if (!email.trim()) return;
        setLoading(true);
        setError(null);
        const res = await fetch('/api/epass/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        setLoading(false);
        if (!res.ok) {
            if (res.status === 404) {
                setPageState('not_found');
            } else {
                setError(data.error || 'Failed to send code. Try again.');
            }
            return;
        }
        setPageState('otp');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }

    async function verifyOtp() {
        const code = otpDigits.join('');
        if (code.length !== 6) return;
        setLoading(true);
        setError(null);
        const res = await fetch('/api/epass/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email.trim(), code }),
        });
        const data = await res.json();
        if (!res.ok) {
            setLoading(false);
            setError(data.error || 'Invalid code. Try again.');
            return;
        }

        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(data.subscriber.email, {
            width: 240,
            margin: 2,
            color: { dark: '#FFFFFF', light: '#0e0e0e' },
        });
        localStorage.setItem(SESSION_KEY, data.subscriber.email);
        setSubscriber(data.subscriber);
        setQrDataUrl(url);
        setPageState('profile');
        setLoading(false);
        void syncGoogleWallet(data.subscriber.email);
    }

    function handleOtpDigit(index: number, value: string) {
        if (!/^\d*$/.test(value)) return;
        const next = [...otpDigits];
        next[index] = value.slice(-1);
        setOtpDigits(next);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    }

    function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    }

    function signOut() {
        localStorage.removeItem(SESSION_KEY);
        setPageState('email');
        setSubscriber(null);
        setQrDataUrl(null);
        setEmail('');
        setOtpDigits(['', '', '', '', '', '']);
        setError(null);
    }

    const tier = subscriber ? getTier(subscriber.visit_count) : null;

    if (loading && pageState === 'email') {
        return (
            <div className="w-full max-w-sm flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm">
            {/* Logo */}
            <div className="text-center mb-10">
                <div className="relative w-32 h-8 mx-auto mb-3">
                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain" priority />
                </div>
                <p className="text-savron-silver/40 text-[10px] uppercase tracking-[0.4em]">Members ePass</p>
            </div>

            <AnimatePresence mode="wait">

                {/* ── Email input ── */}
                {pageState === 'email' && (
                    <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="bg-savron-grey border border-white/10 rounded-savron p-8 space-y-6">
                        <div className="text-center space-y-1">
                            <p className="text-white font-heading text-lg uppercase tracking-widest">Access Your Pass</p>
                            <p className="text-savron-silver/50 text-xs">Enter your email to receive a login code</p>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-savron-silver/40" />
                                <input
                                    type="email"
                                    placeholder="YOUR EMAIL"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                                    className="input-savron pl-12"
                                    autoFocus
                                />
                            </div>
                            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                            <button
                                onClick={sendOtp}
                                disabled={loading || !email.trim()}
                                className="w-full py-3.5 bg-savron-green text-white text-xs uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading
                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <><Mail className="w-3.5 h-3.5" /> Send Login Code</>
                                }
                            </button>
                        </div>
                        <p className="text-center text-savron-silver/30 text-[10px] uppercase tracking-widest">
                            We&apos;ll email you a 6-digit code
                        </p>
                    </motion.div>
                )}

                {/* ── OTP input ── */}
                {pageState === 'otp' && (
                    <motion.div key="otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="bg-savron-grey border border-white/10 rounded-savron p-8 space-y-6">
                        <div className="text-center space-y-1">
                            <Shield className="w-8 h-8 text-savron-green mx-auto mb-3" />
                            <p className="text-white font-heading text-lg uppercase tracking-widest">Check Your Email</p>
                            <p className="text-savron-silver/50 text-xs">
                                6-digit code sent to <span className="text-white">{email}</span>
                            </p>
                        </div>

                        <div className="flex justify-center gap-2">
                            {otpDigits.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => { otpRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleOtpDigit(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    className={cn(
                                        "w-11 h-12 text-center text-white text-lg font-mono bg-savron-charcoal border rounded-savron outline-none transition-all",
                                        digit ? "border-savron-green" : "border-white/15 focus:border-savron-green/60"
                                    )}
                                />
                            ))}
                        </div>

                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                        <button
                            onClick={verifyOtp}
                            disabled={loading || otpDigits.some(d => !d)}
                            className="w-full py-3.5 bg-savron-green text-white text-xs uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : 'Verify Code'
                            }
                        </button>

                        <button
                            onClick={() => { setPageState('email'); setOtpDigits(['', '', '', '', '', '']); setError(null); }}
                            className="w-full text-center text-savron-silver/40 hover:text-savron-silver text-xs uppercase tracking-widest transition-colors"
                        >
                            ← Back
                        </button>
                    </motion.div>
                )}

                {/* ── Profile + QR ── */}
                {pageState === 'profile' && subscriber && tier && (
                    <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="space-y-4">

                        {/* Membership card */}
                        <div className={cn("bg-savron-charcoal border rounded-savron p-6 space-y-4", tier.border)}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className={cn("text-[10px] uppercase tracking-widest font-medium", tier.color)}>{tier.label}</p>
                                    <p className="text-white font-heading text-xl uppercase tracking-wider mt-0.5">{subscriber.name}</p>
                                </div>
                                <Scissors className="w-5 h-5 text-savron-silver/30" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-savron-grey/60 rounded-savron p-3">
                                    <p className="text-savron-silver/40 text-[9px] uppercase tracking-widest">Visits</p>
                                    <p className="text-white font-mono text-2xl font-bold mt-0.5">{subscriber.visit_count}</p>
                                </div>
                                <div className="bg-savron-grey/60 rounded-savron p-3">
                                    <p className="text-savron-silver/40 text-[9px] uppercase tracking-widest">Last Visit</p>
                                    <p className="text-white text-xs mt-1 leading-tight">
                                        {subscriber.last_visit_at
                                            ? formatDistanceToNow(new Date(subscriber.last_visit_at), { addSuffix: true })
                                            : 'No visits yet'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="bg-savron-grey border border-white/10 rounded-savron p-6 flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2">
                                <QrCode className="w-3.5 h-3.5 text-savron-green" />
                                <p className="text-[10px] uppercase tracking-widest text-savron-silver/50">Your ePass QR Code</p>
                            </div>

                            {qrDataUrl ? (
                                <div className="bg-[#0e0e0e] p-3 rounded-savron border border-white/5">
                                    <img src={qrDataUrl} alt="ePass QR Code" width={220} height={220} className="block" />
                                </div>
                            ) : (
                                <div className="w-[220px] h-[220px] flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                                </div>
                            )}

                            <p className="text-center text-savron-silver/30 text-[10px] uppercase tracking-widest">
                                Show this to your barber at check-in
                            </p>
                            <a
                                href={SHOP_MAPS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-center text-savron-silver/40 hover:text-savron-silver text-[10px] tracking-wide transition-colors"
                            >
                                {SHOP_ADDRESS}
                            </a>
                        </div>

                        {/* Sign out */}
                        <button
                            onClick={signOut}
                            className="w-full flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-widest text-savron-silver/40 hover:text-savron-silver transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Sign Out
                        </button>
                    </motion.div>
                )}

                {/* ── Not found ── */}
                {pageState === 'not_found' && (
                    <motion.div key="not_found" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-savron-grey border border-white/10 rounded-savron p-8 text-center space-y-4">
                        <p className="text-white font-heading uppercase tracking-wider">No Pass Found</p>
                        <p className="text-savron-silver/50 text-sm">
                            No ePass is linked to <span className="text-white">{email}</span>.
                            Ask a SAVRON staff member to add you.
                        </p>
                        <button
                            onClick={() => { setPageState('email'); setError(null); }}
                            className="text-emerald-400 hover:text-emerald-300 text-xs uppercase tracking-widest hover:underline"
                        >
                            Try a different email →
                        </button>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}
