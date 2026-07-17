"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode, type MouseEvent, type TouchEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Mail, Shield, QrCode, LogOut, Crown, Sparkles, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase';
import { SHOP_ADDRESS, SHOP_MAPS_URL } from '@/lib/shop';
import InlineBookingSection from '@/components/booking/InlineBookingSection';

type PageState = 'email' | 'otp' | 'profile' | 'not_found';
type TierId = 'standard' | 'inner_circle' | 'vip';

interface Subscriber {
    name: string;
    email: string;
    visit_count: number;
    last_visit_at: string | null;
    issued_at: string;
}

const TIER_CONFIG: Record<TierId, {
    label: string;
    color: string;
    accent: string;
    glow: string;
    border: string;
    gradient: string;
    shimmer?: string;
    icon: typeof Award;
    min: number;
    max: number;
}> = {
    standard: {
        label: 'Standard Member',
        color: 'text-savron-silver',
        accent: 'text-savron-cream/80',
        glow: 'shadow-[0_0_40px_rgba(200,200,200,0.08)]',
        border: 'border-savron-silver/25',
        gradient: 'from-savron-charcoal via-[#1e1e1c] to-savron-grey',
        icon: Award,
        min: 0,
        max: 9,
    },
    inner_circle: {
        label: 'Inner Circle',
        color: 'text-blue-300',
        accent: 'text-blue-200/90',
        glow: 'shadow-[0_0_50px_rgba(59,130,246,0.18)]',
        border: 'border-blue-400/35',
        gradient: 'from-[#0f1a28] via-[#141e2e] to-savron-charcoal',
        shimmer: 'bg-gradient-to-r from-transparent via-blue-400/10 to-transparent',
        icon: Sparkles,
        min: 10,
        max: 24,
    },
    vip: {
        label: 'VIP Member',
        color: 'text-amber-300',
        accent: 'text-amber-200/90',
        glow: 'shadow-[0_0_60px_rgba(251,191,36,0.22)]',
        border: 'border-amber-400/40',
        gradient: 'from-[#1f1808] via-[#2a2010] to-savron-charcoal',
        shimmer: 'bg-[length:200%_100%] bg-gradient-to-r from-amber-500/0 via-amber-300/20 to-amber-500/0 animate-epass-shimmer',
        icon: Crown,
        min: 25,
        max: Infinity,
    },
};

function getTierId(visits: number): TierId {
    if (visits >= 25) return 'vip';
    if (visits >= 10) return 'inner_circle';
    return 'standard';
}

function getTier(visits: number) {
    return TIER_CONFIG[getTierId(visits)];
}

const SESSION_KEY = 'epass_email';

function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-savron border border-white/10 bg-savron-grey/80 backdrop-blur-md p-8 space-y-6',
                'shadow-[0_20px_60px_rgba(0,0,0,0.45)]',
                className,
            )}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            {children}
        </div>
    );
}

function AnimatedVisitCount({ value }: { value: number }) {
    return (
        <motion.span
            key={value}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="text-white font-mono text-3xl font-bold tracking-tight tabular-nums"
        >
            {value}
        </motion.span>
    );
}

function TiltPassCard({ tierId, children }: { tierId: TierId; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), { stiffness: 260, damping: 22 });
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), { stiffness: 260, damping: 22 });

    const tier = TIER_CONFIG[tierId];
    const TierIcon = tier.icon;

    function updateTilt(clientX: number, clientY: number) {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        x.set((clientX - rect.left) / rect.width - 0.5);
        y.set((clientY - rect.top) / rect.height - 0.5);
    }

    function resetTilt() {
        x.set(0);
        y.set(0);
    }

    return (
        <div className="perspective-[1000px]" style={{ perspective: '1000px' }}>
            <motion.div
                ref={ref}
                onMouseMove={(e: MouseEvent<HTMLDivElement>) => updateTilt(e.clientX, e.clientY)}
                onMouseLeave={resetTilt}
                onTouchMove={(e: TouchEvent<HTMLDivElement>) => {
                    const touch = e.touches[0];
                    if (touch) updateTilt(touch.clientX, touch.clientY);
                }}
                onTouchEnd={resetTilt}
                style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
                className={cn(
                    'relative aspect-[1.58/1] w-full overflow-hidden rounded-[14px] border p-6',
                    'bg-gradient-to-br',
                    tier.gradient,
                    tier.border,
                    tier.glow,
                )}
            >
                {tier.shimmer && (
                    <div className={cn('pointer-events-none absolute inset-0 opacity-60', tier.shimmer)} />
                )}
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-savron-blue/10 blur-2xl" />

                <div className="relative flex h-full flex-col justify-between" style={{ transform: 'translateZ(20px)' }}>
                    <div className="flex items-start justify-between">
                        <div className="relative h-7 w-24 opacity-90">
                            <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" />
                        </div>
                        <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1', tier.border, 'bg-black/20')}>
                            <TierIcon className={cn('h-3 w-3', tier.color)} />
                            <span className={cn('text-[9px] uppercase tracking-[0.2em] font-medium', tier.color)}>
                                {tier.label}
                            </span>
                        </div>
                    </div>

                    {children}

                    <div className="flex items-end justify-between">
                        <p className="text-[8px] uppercase tracking-[0.35em] text-white/25">Members Club</p>
                        <div className="h-8 w-12 rounded bg-gradient-to-br from-white/10 to-transparent border border-white/10" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function QrFrame({ qrDataUrl }: { qrDataUrl: string | null }) {
    return (
        <div className="relative">
            <div className="pointer-events-none absolute inset-0 rounded-savron ring-1 ring-savron-green/20 animate-epass-glow" />
            <div className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-savron-green/60 rounded-tl-sm" />
            <div className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-savron-green/60 rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-savron-green/60 rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-savron-green/60 rounded-br-sm" />

            <div className="bg-[#0a0a0a] p-4 rounded-savron border border-white/[0.06]">
                {qrDataUrl ? (
                    <img src={qrDataUrl} alt="ePass QR Code" width={220} height={220} className="block" />
                ) : (
                    <div className="w-[220px] h-[220px] flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function EPassPage() {
    const [pageState, setPageState] = useState<PageState>('email');
    const [email, setEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        const saved = localStorage.getItem(SESSION_KEY);
        if (saved) {
            setEmail(saved);
            loadProfile(saved);
        }
    }, []);

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
        }, 2000);

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
            // Non-fatal
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
                setSubscriber(prev => {
                    const next = data.subscriber as Subscriber;
                    if (
                        prev
                        && prev.visit_count === next.visit_count
                        && prev.last_visit_at === next.last_visit_at
                    ) {
                        return prev;
                    }
                    return next;
                });
                const url = await QRCode.toDataURL(data.subscriber.email, {
                    width: 240,
                    margin: 2,
                    color: { dark: '#e8e4dc', light: '#0a0a0a' },
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
            color: { dark: '#e8e4dc', light: '#0a0a0a' },
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
    const tierId = subscriber ? getTierId(subscriber.visit_count) : 'standard';

    if (loading && pageState === 'email') {
        return (
            <div className="w-full max-w-sm flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className={cn('w-full', pageState === 'profile' ? 'max-w-4xl' : 'max-w-sm')}>
            <div className="text-center mb-10">
                <div className="relative w-36 h-9 mx-auto mb-4">
                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain drop-shadow-[0_0_20px_rgba(18,84,112,0.35)]" priority />
                </div>
                <p className="text-savron-silver/50 text-[10px] uppercase tracking-[0.45em]">Members ePass</p>
                <p className="text-savron-silver/25 text-[9px] uppercase tracking-[0.3em] mt-1">Barbershop & Lounge</p>
            </div>

            <AnimatePresence mode="wait">

                {pageState === 'email' && (
                    <motion.div key="email" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                        <GlassPanel>
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
                                    className="w-full py-3.5 bg-gradient-to-r from-savron-blue to-savron-blue-light text-white text-xs uppercase tracking-widest rounded-savron hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(18,84,112,0.35)]"
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
                        </GlassPanel>
                    </motion.div>
                )}

                {pageState === 'otp' && (
                    <motion.div key="otp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                        <GlassPanel>
                            <div className="text-center space-y-1">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-savron-green/30 bg-savron-green/10">
                                    <Shield className="w-5 h-5 text-savron-green-light" />
                                </div>
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
                                            'w-11 h-12 text-center text-white text-lg font-mono bg-savron-charcoal/80 border rounded-savron outline-none transition-all',
                                            digit ? 'border-savron-green shadow-[0_0_12px_rgba(18,84,112,0.35)]' : 'border-white/15 focus:border-savron-green/60',
                                        )}
                                    />
                                ))}
                            </div>

                            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                            <button
                                onClick={verifyOtp}
                                disabled={loading || otpDigits.some(d => !d)}
                                className="w-full py-3.5 bg-gradient-to-r from-savron-blue to-savron-blue-light text-white text-xs uppercase tracking-widest rounded-savron hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                        </GlassPanel>
                    </motion.div>
                )}

                {pageState === 'profile' && subscriber && tier && (
                    <motion.div key="profile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                        className="space-y-5">

                        <TiltPassCard tierId={tierId}>
                            <div className="space-y-4">
                                <div>
                                    <p className={cn('text-[9px] uppercase tracking-[0.3em]', tier.color)}>Member</p>
                                    <p className="text-white font-heading text-2xl uppercase tracking-wider mt-1 leading-tight">
                                        {subscriber.name}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-savron border border-white/[0.06] bg-black/25 px-3 py-2.5 backdrop-blur-sm">
                                        <p className="text-white/35 text-[8px] uppercase tracking-[0.25em]">Visits</p>
                                        <AnimatedVisitCount value={subscriber.visit_count} />
                                    </div>
                                    <div className="rounded-savron border border-white/[0.06] bg-black/25 px-3 py-2.5 backdrop-blur-sm">
                                        <p className="text-white/35 text-[8px] uppercase tracking-[0.25em]">Last Visit</p>
                                        <p className={cn('text-xs mt-1.5 leading-tight font-medium', tier.accent)}>
                                            {subscriber.last_visit_at
                                                ? formatDistanceToNow(new Date(subscriber.last_visit_at), { addSuffix: true })
                                                : 'No visits yet'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </TiltPassCard>

                        <GlassPanel className="p-6 flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2">
                                <QrCode className="w-3.5 h-3.5 text-savron-green-light" />
                                <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/50">Scan at Check-In</p>
                            </div>

                            <QrFrame qrDataUrl={qrDataUrl} />

                            <p className="text-center text-savron-silver/35 text-[10px] uppercase tracking-widest max-w-[220px]">
                                Show this to your barber. updates live after every visit
                            </p>
                            <a
                                href={SHOP_MAPS_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-center text-savron-silver/40 hover:text-savron-cream text-[10px] tracking-wide transition-colors"
                            >
                                {SHOP_ADDRESS}
                            </a>
                        </GlassPanel>

                        <GlassPanel className="p-6 sm:p-8">
                            <InlineBookingSection
                                prefillName={subscriber.name}
                                prefillEmail={subscriber.email}
                            />
                        </GlassPanel>

                        <button
                            onClick={signOut}
                            className="w-full flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-widest text-savron-silver/40 hover:text-savron-silver transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Sign Out
                        </button>
                    </motion.div>
                )}

                {pageState === 'not_found' && (
                    <motion.div key="not_found" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                        <GlassPanel className="text-center space-y-4">
                            <p className="text-white font-heading uppercase tracking-wider">No Pass Found</p>
                            <p className="text-savron-silver/50 text-sm">
                                No ePass is linked to <span className="text-white">{email}</span>.
                                Ask a SAVRON staff member to add you.
                            </p>
                            <button
                                onClick={() => { setPageState('email'); setError(null); }}
                                className="text-savron-blue-light hover:text-white text-xs uppercase tracking-widest hover:underline transition-colors"
                            >
                                Try a different email →
                            </button>
                        </GlassPanel>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}
