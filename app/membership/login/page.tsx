"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { CreditCard } from 'lucide-react';

export default function MembershipLoginPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        await new Promise(r => setTimeout(r, 800));

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError('Invalid credentials');
            setLoading(false);
            return;
        }

        router.push('/membership');
        router.refresh();
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        await new Promise(r => setTimeout(r, 800));

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        if (authData.user) {
            // Create client record
            await supabase.from('clients').insert({
                auth_id: authData.user.id,
                name,
                email,
                phone,
                membership_status: 'standard',
                visit_count: 0,
            });

            // Create user_roles record
            await supabase.from('user_roles').insert({
                auth_id: authData.user.id,
                role: 'client',
            });
        }

        router.push('/membership');
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
                        <CreditCard className="w-4 h-4" />
                        <p className="text-xs uppercase tracking-widest font-medium">Membership</p>
                    </div>
                </div>

                {/* Toggle */}
                <div className="flex border border-white/10 rounded-savron overflow-hidden">
                    <button
                        onClick={() => setMode('login')}
                        className={`flex-1 py-3 text-xs uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-savron-green text-white' : 'text-savron-silver hover:text-white'}`}
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => setMode('register')}
                        className={`flex-1 py-3 text-xs uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-savron-green text-white' : 'text-savron-silver hover:text-white'}`}
                    >
                        Register
                    </button>
                </div>

                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="input-savron" required />
                        <input type="password" placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)} className="input-savron" required />
                        {error && <p className="text-red-400 text-xs uppercase tracking-wider">{error}</p>}
                        <button type="submit" disabled={loading} className="w-full py-4 bg-savron-green text-white font-heading uppercase tracking-widest text-sm rounded-savron hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign In'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <input placeholder="FULL NAME" value={name} onChange={e => setName(e.target.value)} className="input-savron" required />
                        <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="input-savron" required />
                        <input type="tel" placeholder="PHONE" value={phone} onChange={e => setPhone(e.target.value)} className="input-savron" required />
                        <input type="password" placeholder="PASSWORD (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} className="input-savron" required minLength={6} />
                        {error && <p className="text-red-400 text-xs uppercase tracking-wider">{error}</p>}
                        <button type="submit" disabled={loading} className="w-full py-4 bg-savron-green text-white font-heading uppercase tracking-widest text-sm rounded-savron hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Account'}
                        </button>
                    </form>
                )}

                <p className="text-center text-savron-silver/40 text-[10px] uppercase tracking-widest">
                    SAVRON Members Club
                </p>
            </motion.div>
        </main>
    );
}
