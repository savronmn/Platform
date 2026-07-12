"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Scissors } from 'lucide-react';
import type { Barber } from '@/lib/types';

export default function BarberSlugLoginPage() {
    const params = useParams();
    const slug = params.slug as string;
    const router = useRouter();
    const supabase = createClient();

    const [barber, setBarber] = useState<Barber | null>(null);
    const [loadingBarber, setLoadingBarber] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function load() {
            const { data } = await supabase.from('barbers').select('*').eq('slug', slug).maybeSingle();
            setBarber(data);
            setLoadingBarber(false);
        }
        load();
    }, [slug]);

    useEffect(() => {
        async function checkSession() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !barber) return;
            if (barber.auth_id === user.id) {
                router.replace(`/barber/${slug}/calendar`);
            }
        }
        if (barber) checkSession();
    }, [barber, slug, router]);

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
                        disabled={loading}
                        className="w-full py-4 bg-savron-green text-white font-heading uppercase tracking-widest text-sm rounded-savron hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : 'Sign In'}
                    </button>
                </form>

                <p className="text-center text-savron-silver/70 text-[10px] uppercase tracking-widest">
                    SAVRON · {barber.name.split(' ')[0]}&apos;s Schedule
                </p>
            </motion.div>
        </main>
    );
}
