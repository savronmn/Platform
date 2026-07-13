"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, ExternalLink, Eye } from 'lucide-react';
import type { Barber } from '@/lib/types';
import {
    barberBookingPageUrl,
    barberPortalLoginUrl,
    barberPortalCalendarUrl,
} from '@/lib/barber-portal-urls';

export default function AdminBarberPortalPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const barberId = params.id as string;
    const supabase = createClient();

    const [barber, setBarber] = useState<Barber | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<'portal' | 'booking' | null>(null);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/admin/login');
                return;
            }

            const { data: barberData } = await supabase
                .from('barbers')
                .select('*')
                .eq('id', barberId)
                .single();

            if (!barberData) {
                router.push('/admin/barbers');
                return;
            }

            setBarber(barberData);
            setLoading(false);
        }
        void load();
    }, [barberId, router, supabase]);

    const copyText = async (text: string, key: 'portal' | 'booking') => {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    if (!barber) return null;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const portalLoginUrl = barberPortalLoginUrl(barber.slug, origin);
    const portalCalendarUrl = `${barberPortalCalendarUrl(barber.slug, origin)}?adminPreview=1`;
    const bookingUrl = barberBookingPageUrl(barber.slug, origin);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-page space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <Link
                        href="/admin/barbers"
                        className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-savron-silver hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Barbers
                    </Link>
                    <div>
                        <p className="admin-kicker">Portal Preview</p>
                        <h1 className="admin-title">{barber.name}</h1>
                        <p className="admin-subtitle">
                            See the calendar portal as this barber sees it. Send them the login link below.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => void copyText(portalLoginUrl, 'portal')}
                        className="flex items-center gap-2 px-4 py-2.5 border border-white/10 rounded-savron text-[10px] uppercase tracking-widest text-savron-silver hover:text-white hover:border-white/25 transition-all"
                    >
                        {copied === 'portal' ? <Check className="w-3.5 h-3.5 text-savron-green" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === 'portal' ? 'Portal Link Copied' : 'Copy Portal Login Link'}
                    </button>
                    <button
                        onClick={() => void copyText(bookingUrl, 'booking')}
                        className="flex items-center gap-2 px-4 py-2.5 border border-white/10 rounded-savron text-[10px] uppercase tracking-widest text-savron-silver hover:text-white hover:border-white/25 transition-all"
                    >
                        {copied === 'booking' ? <Check className="w-3.5 h-3.5 text-savron-green" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === 'booking' ? 'Booking Link Copied' : 'Copy Booking Link'}
                    </button>
                    <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 border border-white/10 rounded-savron text-[10px] uppercase tracking-widest text-savron-silver hover:text-white hover:border-white/25 transition-all"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Booking Page
                    </a>
                </div>
            </div>

            <div className="rounded-savron border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
                <Eye className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-amber-100 text-sm font-medium">Admin preview mode</p>
                    <p className="text-amber-100/70 text-xs leading-relaxed">
                        This is a read-only view of <span className="font-mono">{portalLoginUrl}</span> after login.
                        Cancel and check-in actions are disabled here.
                    </p>
                </div>
            </div>

            <div className="rounded-savron border border-white/10 overflow-hidden bg-savron-charcoal/40">
                <iframe
                    title={`${barber.name} portal preview`}
                    src={portalCalendarUrl}
                    className="w-full min-h-[78vh] bg-savron-black"
                />
            </div>
        </motion.div>
    );
}
