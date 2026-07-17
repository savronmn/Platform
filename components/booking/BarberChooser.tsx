"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Barber } from '@/lib/types';
import { useServices } from '@/lib/use-services';
import {
    barberOffersAnyService,
    buildBarberPageUrl,
    resolveServiceFromParam,
} from '@/lib/booking-utils';
import { SelectedServiceBanner } from '@/components/booking/SelectedServiceBanner';

const PLACEHOLDER_BARBERS: Barber[] = [
    {
        id: 'ph-1', auth_id: null, name: 'Albi A.', slug: 'albi-a', role: 'Master Barber & Owner',
        bio: null, specialties: ['Skin Fades', 'Beard Design'], image_url: null, phone: null,
        email: null, instagram_url: null, license_number: null, services_offered: null,
        google_calendar_id: null, google_calendar_tokens: null, google_sync_token: null,
        google_channel_id: null, google_resource_id: null, working_hours: null,
        portfolio_images: null, booking_links: null, active: true, created_at: '',
    },
    {
        id: 'ph-2', auth_id: null, name: 'Marcus V.', slug: 'marcus-v', role: 'Master Barber',
        bio: null, specialties: ['Signature Fades', 'Hot Towel Shaves'], image_url: null, phone: null,
        email: null, instagram_url: null, license_number: null, services_offered: null,
        google_calendar_id: null, google_calendar_tokens: null, google_sync_token: null,
        google_channel_id: null, google_resource_id: null, working_hours: null,
        portfolio_images: null, booking_links: null, active: true, created_at: '',
    },
    {
        id: 'ph-3', auth_id: null, name: 'James D.', slug: 'james-d', role: 'Senior Stylist',
        bio: null, specialties: ['Modern Cuts', 'Textured Styles'], image_url: null, phone: null,
        email: null, instagram_url: null, license_number: null, services_offered: null,
        google_calendar_id: null, google_calendar_tokens: null, google_sync_token: null,
        google_channel_id: null, google_resource_id: null, working_hours: null,
        portfolio_images: null, booking_links: null, active: true, created_at: '',
    },
    {
        id: 'ph-4', auth_id: null, name: 'Leo R.', slug: 'leo-r', role: 'Barber',
        bio: null, specialties: ['Classic Cuts', 'Kids Cuts'], image_url: null, phone: null,
        email: null, instagram_url: null, license_number: null, services_offered: null,
        google_calendar_id: null, google_calendar_tokens: null, google_sync_token: null,
        google_channel_id: null, google_resource_id: null, working_hours: null,
        portfolio_images: null, booking_links: null, active: true, created_at: '',
    },
];

type BarberChooserProps = {
    preselectedServiceName?: string | null;
    prefillName?: string;
    prefillEmail?: string;
    compact?: boolean;
};

export default function BarberChooser({ preselectedServiceName, prefillName, prefillEmail, compact = false }: BarberChooserProps) {
    const supabase = createClient();
    const services = useServices();
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [loadingBarbers, setLoadingBarbers] = useState(true);
    const [barbersError, setBarbersError] = useState(false);

    const preselectedService = resolveServiceFromParam(preselectedServiceName, services);
    const filterServiceNames = preselectedService ? [preselectedService.name] : [];

    useEffect(() => {
        async function fetchBarbers() {
            setLoadingBarbers(true);
            setBarbersError(false);
            const { data, error } = await supabase
                .from('barbers')
                .select('*')
                .eq('active', true)
                .order('name');
            if (error) {
                console.error('[BarberChooser] Failed to fetch barbers:', error);
                setBarbersError(true);
            }
            if (data && data.length > 0) setBarbers(data);
            setLoadingBarbers(false);
        }
        fetchBarbers();
    }, []);

    const displayBarbers = (barbers.length > 0 ? barbers : PLACEHOLDER_BARBERS).filter((pro) =>
        barberOffersAnyService(pro, filterServiceNames),
    );

    const retryFetch = () => {
        setBarbers([]);
        setBarbersError(false);
        setLoadingBarbers(true);
        supabase.from('barbers').select('*').eq('active', true).order('name')
            .then(({ data, error }) => {
                if (error) setBarbersError(true);
                if (data && data.length > 0) setBarbers(data);
                setLoadingBarbers(false);
            });
    };

    return (
        <div className={cn(compact ? 'space-y-4' : 'space-y-6')}>
            {preselectedService && (
                <SelectedServiceBanner service={preselectedService} />
            )}

            <div>
                <h2 className={cn(
                    'font-heading text-white uppercase tracking-wider',
                    compact ? 'text-lg' : 'text-xl md:text-2xl',
                )}>
                    Choose Your Barber
                </h2>
                <p className="text-savron-silver/65 text-sm mt-1.5 leading-relaxed">
                    {preselectedService
                        ? `Showing barbers who offer ${preselectedService.name}. Tap a profile to view their services and book.`
                        : 'Browse our team, read their story, and book directly from their page.'}
                </p>
            </div>

            {loadingBarbers ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                </div>
            ) : barbersError ? (
                <div className="text-center py-12 space-y-3">
                    <p className="text-savron-silver/60 text-sm">Unable to load team</p>
                    <button
                        type="button"
                        onClick={retryFetch}
                        className="text-xs text-savron-blue-light uppercase tracking-widest hover:text-savron-blue-light transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : displayBarbers.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                    <p className="text-savron-silver/60 text-sm">No barbers currently offer this service.</p>
                    <Link
                        href="/booking"
                        className="inline-block text-sm text-savron-blue-light uppercase tracking-widest hover:text-savron-blue-light transition-colors min-h-[44px] px-4"
                    >
                        View all barbers
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {displayBarbers.map((pro, index) => (
                        <motion.div
                            key={pro.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                        >
                            <Link
                                href={buildBarberPageUrl(pro.slug, {
                                    serviceName: preselectedService?.name,
                                    name: prefillName,
                                    email: prefillEmail,
                                })}
                                className="group block p-5 border border-white/[0.06] hover:border-savron-green/40 bg-savron-grey rounded-savron transition-all duration-300 touch-manipulation"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-full overflow-hidden bg-savron-charcoal border border-white/10 flex-shrink-0 relative transition-transform duration-300 group-hover:scale-105">
                                        {pro.image_url ? (
                                            <Image
                                                src={pro.image_url}
                                                alt={pro.name}
                                                fill
                                                sizes="64px"
                                                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-savron-silver/40 text-lg font-heading">
                                                {pro.name.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <h3 className="text-white text-base font-heading uppercase tracking-widest leading-tight">
                                            {pro.name}
                                        </h3>
                                        <p className="text-savron-blue-light/80 text-[11px] uppercase tracking-wider">
                                            {pro.role}
                                        </p>
                                        {pro.bio && (
                                            <p className="text-savron-silver/55 text-xs leading-relaxed line-clamp-2">
                                                {pro.bio}
                                            </p>
                                        )}
                                        {pro.specialties && pro.specialties.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {pro.specialties.slice(0, 3).map((s, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-white/5 text-savron-silver/60 border border-white/[0.06]"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
                                    <span className="text-[11px] uppercase tracking-widest text-savron-silver/50 group-hover:text-white transition-colors">
                                        View profile & book
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-savron-silver/40 group-hover:text-savron-green group-hover:translate-x-0.5 transition-all duration-300" />
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
