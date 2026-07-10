"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function AdminLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Luxury delay — deliberate processing feel
        await new Promise(resolve => setTimeout(resolve, 800));

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError('Invalid credentials. Access denied.');
            setLoading(false);
            return;
        }

        await fetch('/api/admin/ensure-role', { method: 'POST' });

        router.push('/admin');
        router.refresh();
    };

    return (
        <main className="min-h-screen bg-savron-black savron-grid-bg flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="flex justify-center mb-12">
                    <div className="relative w-48 h-12">
                        <Image src="/logo.png" alt="SAVRON" fill className="object-contain" priority />
                    </div>
                </div>

                {/* Card */}
                <div className="glass-panel-strong p-8 md:p-10 rounded-savron">
                    <h1 className="font-heading text-xl uppercase tracking-widest text-white text-center mb-2">
                        Admin Access
                    </h1>
                    <p className="text-savron-silver text-xs uppercase tracking-wider text-center mb-8">
                        Authorized Personnel Only
                    </p>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-savron-silver">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-savron"
                                placeholder="admin@savron.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-savron-silver">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-savron"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-red-400 text-xs uppercase tracking-wider text-center"
                            >
                                {error}
                            </motion.p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-savron-blue text-white font-heading uppercase tracking-widest text-sm py-4 rounded-savron hover:bg-savron-blue-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 glow-blue"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Authenticate'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-savron-silver/60 text-xs text-center mt-8 uppercase tracking-widest">
                    SAVRON Business OS
                </p>
            </motion.div>
        </main>
    );
}
