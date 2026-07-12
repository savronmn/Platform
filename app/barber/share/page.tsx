"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Copy, Check, ExternalLink, QrCode, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { Barber } from '@/lib/types';

export default function BarberSharePage() {
    const supabase = createClient();
    const [barber, setBarber] = useState<Barber | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('barbers')
                .select('*')
                .eq('auth_id', user.id)
                .single();
            if (data) setBarber(data);
            setLoading(false);
        }
        load();
    }, []);

    const bookingUrl = barber ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${barber.slug}` : '';
    const calendarUrl = barber ? `${typeof window !== 'undefined' ? window.location.origin : ''}/barber/${barber.slug}/calendar` : '';
    const calendarLoginUrl = barber ? `${typeof window !== 'undefined' ? window.location.origin : ''}/barber/${barber.slug}/login` : '';

    const copyLink = () => {
        navigator.clipboard.writeText(bookingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    if (!barber) {
        return (
            <div className="text-center py-20 space-y-4">
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">Account Not Linked</h1>
                <p className="text-savron-silver text-sm">Your login is not linked to a barber profile. Contact admin.</p>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto bg-savron-green/15 border border-savron-green/25 rounded-full flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-savron-blue-light" />
                </div>
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">My Booking Page</h1>
                <p className="text-savron-silver text-xs uppercase tracking-widest">
                    Share this link with clients to let them book directly with you
                </p>
            </div>

            {/* Calendar Link */}
            <div className="bg-savron-grey border border-white/5 rounded-savron p-6 space-y-5">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-2">Your Calendar Portal</p>
                    <div className="flex items-center gap-3 bg-savron-black border border-white/[0.06] rounded-savron p-3">
                        <span className="text-savron-silver text-sm font-mono truncate flex-1">{calendarLoginUrl}</span>
                    </div>
                    <p className="text-savron-silver/50 text-xs mt-2">Bookmark this link to sign in and view your schedule.</p>
                </div>
                <a href={calendarUrl} className="block">
                    <Button variant="outline" className="w-full flex gap-2 justify-center">
                        <ExternalLink className="w-4 h-4" />
                        Open My Calendar
                    </Button>
                </a>
            </div>

            {/* Link Card */}
            <div className="bg-savron-grey border border-white/5 rounded-savron p-6 space-y-5">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-2">Your Personal Link</p>
                    <div className="flex items-center gap-3 bg-savron-black border border-white/[0.06] rounded-savron p-3">
                        <span className="text-savron-silver text-sm font-mono truncate flex-1">{bookingUrl}</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={copyLink} className="flex-1 flex gap-2 justify-center">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                    <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                    >
                        <Button variant="outline" className="w-full flex gap-2 justify-center">
                            <ExternalLink className="w-4 h-4" />
                            Preview Page
                        </Button>
                    </a>
                </div>
            </div>

            {/* Share Tips */}
            <div className="bg-savron-grey border border-white/5 rounded-savron p-6">
                <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-4">How to Use</p>
                <div className="space-y-4">
                    {[
                        { title: 'Text / DM Clients', desc: 'Send them your booking link directly.' },
                        { title: 'Instagram Bio', desc: 'Add the link to your Instagram bio for easy access.' },
                        { title: 'Business Card', desc: 'Print your link or a QR code on your cards.' },
                        { title: 'Social Media Posts', desc: 'Share the link in your stories and posts.' },
                    ].map((tip, i) => (
                        <div key={i} className="flex gap-3">
                            <div className="w-6 h-6 flex-shrink-0 bg-savron-green/10 border border-savron-green/20 rounded-full flex items-center justify-center text-savron-blue-light text-[10px] font-heading">
                                {i + 1}
                            </div>
                            <div>
                                <p className="text-white text-sm font-medium">{tip.title}</p>
                                <p className="text-savron-silver/60 text-xs">{tip.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
