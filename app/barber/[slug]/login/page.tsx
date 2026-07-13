"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Scissors } from 'lucide-react';
import type { Barber } from '@/lib/types';

const CAL_ERROR_MESSAGES: Record<string, string> = {
    email_mismatch: 'Use the Google account that matches your SAVRON barber email on file.',
    google_email_unavailable: 'Could not read your Google email. Please try again.',
    account_not_linked: 'This barber profile is not linked to a login account yet. Contact admin.',
    login_failed: 'Google calendar connected, but sign-in failed. Try email/password or contact admin.',
    token_exchange_failed: 'Google authorization failed. Please try again.',
    missing_params: 'Google sign-in was interrupted. Please try again.',
    barber_not_found: 'Barber profile not found.',
};

export default function BarberSlugLoginPage() {
    const params = useParams();
    const slug = params.slug as string;
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const [barber, setBarber] = useState<Barber | null>(null);
    const [loadingBarber, setLoadingBarber] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    useEffect(() => {
        const calError = searchParams.get('cal_error');
        if (calError) {
            setError(CAL_ERROR_MESSAGES[calError] ?? 'Google sign-in failed. Please try again.');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [searchParams]);

    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('barbers').select('*').eq('slug', slug).maybeSingle();
            setBarber(data);
            setLoadingBarber(false);
        }
        load();
    }, [slug, supabase]);

    useEffect(() => {
        async function checkSession() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !barber) return;
            if (barber.auth_id === user.id) {
                router.replace(`/barber/${slug}/calendar`);
            }
        }
        if (barber) checkSession();
    }, [barber, slug, router, supabase]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError || !authData.user) {
            setError('Invalid credentials');
            setLoading(false);
            return;
        }

        if (!barber) {
            setError('Barber profile not found');
            setLoading(false);
            return;
        }

        if (barber.auth_id !== authData.user.id) {
            await supabase.auth.signOut();
            setError('This account is not linked to this barber profile');
            setLoading(false);
            return;
        }

        router.push(`/barber/${slug}/calendar`);
        router.refresh();
    };

    const handleGoogleLogin = () => {
        if (!barber) return;
        setGoogleLoading(true);
        setError('');
        const params = new URLSearchParams({
            barberId: barber.id,
            redirect: `/barber/${slug}/calendar`,
            login: '1',
        });
        window.location.href = `/api/calendar/connect?${params.toString()}`;
    };

    if (loadingBarber) {
        return (
            <main className="min-h-screen bg-savron-black flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </main>
        );
    }

    if (!barber) {
        return (
            <main className="min-h-screen bg-savron-black flex items-center justify-center px-6">
                <div className="text-center space-y-3">
                    <h1 className="font-heading text-2xl uppercase tracking-widest text-white">Barber Not Found</h1>
                    <p className="text-savron-silver text-sm">This calendar link is invalid.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-savron-black flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm space-y-8"
            >
                <div className="text-center space-y-4">
                    <div className="relative w-32 h-8 mx-auto">
                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain" priority />
                    </div>
                    {barber.image_url ? (
                        <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden border border-white/10">
                            <Image src={barber.image_url} alt={barber.name} fill className="object-cover" />
                        </div>
                    ) : null}
                    <div>
                        <p className="font-heading text-xl uppercase tracking-widest text-white">{barber.name}</p>
                        <div className="flex items-center justify-center gap-2 text-savron-blue-light mt-2">
                            <Scissors className="w-4 h-4" />
                            <p className="text-xs uppercase tracking-widest font-medium">My Calendar</p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || loading}
                    className="w-full py-4 bg-white text-savron-black font-heading uppercase tracking-widest text-sm rounded-savron hover:bg-savron-cream transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    {googleLoading ? (
                        <div className="w-4 h-4 border-2 border-savron-black/30 border-t-savron-black rounded-full animate-spin" />
                    ) : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </>
                    )}
                </button>

                <p className="text-center text-savron-silver/50 text-[10px] uppercase tracking-widest">
                    Sign in and connect your Google Calendar in one step
                </p>

                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/40">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="email"
                        placeholder="EMAIL"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="input-savron"
                        required
                    />
                    <input
                        type="password"
                        placeholder="PASSWORD"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="input-savron"
                        required
                    />

                    {error && <p className="text-red-400 text-xs uppercase tracking-wider">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full py-4 bg-savron-green text-white font-heading uppercase tracking-widest text-sm rounded-savron hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : 'Sign In with Email'}
                    </button>
                </form>

                {barber.email && (
                    <p className="text-center text-savron-silver/40 text-[10px] leading-relaxed">
                        Google sign-in must use <span className="text-savron-silver/70">{barber.email}</span>
                    </p>
                )}

                <p className="text-center text-savron-silver/70 text-[10px] uppercase tracking-widest">
                    SAVRON · {barber.name.split(' ')[0]}&apos;s Schedule
                </p>
            </motion.div>
        </main>
    );
}
