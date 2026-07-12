"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Scissors } from 'lucide-react';

export default function BarberLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        await new Promise(r => setTimeout(r, 800));

        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !authData.user) {
            setError('Invalid credentials');
            setLoading(false);
            return;
        }

        const { data: barberData } = await supabase
            .from('barbers')
            .select('slug')
            .eq('auth_id', authData.user.id)
            .maybeSingle();

        if (barberData?.slug) {
            router.push(`/barber/${barberData.slug}/calendar`);
        } else {
            router.push('/barber');
        }
        router.refresh();
    };

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
                    <div className="flex items-center justify-center gap-2 text-savron-blue-light">
                        <Scissors className="w-4 h-4" />
                        <p className="text-xs uppercase tracking-widest font-medium">Barber Portal</p>
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
                    SAVRON Barber Dashboard
                </p>
            </motion.div>
        </main>
    );
}
