"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Upload, X, ImageIcon, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type Barber = {
    id: string;
    name: string;
    role: string | null;
    image_url: string | null;
    portfolio_images: string[] | null;
    instagram_url: string | null;
    google_calendar_tokens?: any;
};

const PORTFOLIO_BUCKET = 'barber-portfolios';

export default function BarberProfilePage() {
    const supabase = createClient();
    const router = useRouter();
    const [barber, setBarber] = useState<Barber | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadingProfile, setUploadingProfile] = useState(false);
    const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
    const [linkingGoogle, setLinkingGoogle] = useState(false);
    const [instagramHandle, setInstagramHandle] = useState('');
    const [savingInstagram, setSavingInstagram] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('cal_connected') === '1') {
            setSuccessMessage('Google Calendar connected successfully!');
        }
        const calError = params.get('cal_error');
        if (calError) {
            setError(`Google Calendar connection failed: ${calError}`);
        }
    }, []);

    useEffect(() => {
        async function load() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push('/barber/login');
                return;
            }

            const { data } = await supabase
                .from('barbers')
                .select('id, name, role, image_url, portfolio_images, instagram_url, google_calendar_tokens')
                .eq('auth_id', session.user.id)
                .single();
            if (data) {
                setBarber(data as Barber);
                const raw = (data as Barber).instagram_url ?? '';
                const handle = raw.includes('instagram.com/')
                    ? raw.split('instagram.com/').pop()?.replace(/^@/, '') ?? ''
                    : raw.replace(/^@/, '');
                setInstagramHandle(handle);
            }
            setLoading(false);
        }
        load();
    }, []);

    async function uploadFile(file: File, pathPrefix: string): Promise<string | null> {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(PORTFOLIO_BUCKET).upload(path, file, {
            cacheControl: '3600',
            upsert: false,
        });
        if (error) {
            setError(`Upload failed: ${error.message}`);
            return null;
        }
        const { data } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path);
        return data.publicUrl;
    }

    async function handleProfilePicChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !barber) return;
        setUploadingProfile(true);
        setError(null);
        const url = await uploadFile(file, `${barber.id}/profile`);
        if (url) {
            const { error } = await supabase
                .from('barbers')
                .update({ image_url: url })
                .eq('id', barber.id);
            if (error) setError(error.message);
            else setBarber({ ...barber, image_url: url });
        }
        setUploadingProfile(false);
    }

    async function handlePortfolioAdd(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0 || !barber) return;
        setUploadingPortfolio(true);
        setError(null);

        const uploaded: string[] = [];
        for (const f of files) {
            const url = await uploadFile(f, `${barber.id}/portfolio`);
            if (url) uploaded.push(url);
        }

        if (uploaded.length > 0) {
            const next = [...(barber.portfolio_images ?? []), ...uploaded];
            const { error } = await supabase
                .from('barbers')
                .update({ portfolio_images: next })
                .eq('id', barber.id);
            if (error) setError(error.message);
            else setBarber({ ...barber, portfolio_images: next });
        }
        setUploadingPortfolio(false);
    }

    async function removePortfolioImage(url: string) {
        if (!barber) return;
        const next = (barber.portfolio_images ?? []).filter(u => u !== url);
        const { error } = await supabase
            .from('barbers')
            .update({ portfolio_images: next })
            .eq('id', barber.id);
        if (!error) setBarber({ ...barber, portfolio_images: next });
    }

    async function handleSaveInstagram() {
        if (!barber) return;
        setSavingInstagram(true);
        setError(null);
        const handle = instagramHandle.trim().replace(/^@/, '');
        const instagram_url = handle ? `https://www.instagram.com/${handle}` : null;
        const { error } = await supabase
            .from('barbers')
            .update({ instagram_url })
            .eq('id', barber.id);
        if (error) setError(error.message);
        else {
            setBarber({ ...barber, instagram_url });
            setSuccessMessage('Instagram updated!');
            setTimeout(() => setSuccessMessage(null), 3000);
        }
        setSavingInstagram(false);
    }

    async function handleConnectGoogle() {
        if (!barber) return;
        setLinkingGoogle(true);
        setError(null);
        window.location.href = `/api/calendar/connect?barberId=${barber.id}&redirect=/barber/profile`;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    if (!barber) {
        return <p className="text-savron-silver">Barber profile not found.</p>;
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 max-w-4xl">
            <div>
                <h1 className="font-heading text-3xl uppercase tracking-widest text-white">My Profile</h1>
                <p className="text-savron-silver text-sm mt-1">Update your photo and portfolio. Other fields require an admin request.</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-savron p-4 text-red-300 text-sm">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-savron-green/20 border border-savron-green-light/35 rounded-savron p-4 text-emerald-300 text-sm">
                    {successMessage}
                </div>
            )}

            {/* Profile photo */}
            <section className="card-savron space-y-5">
                <h2 className="font-heading uppercase tracking-widest text-white text-sm">Profile Photo</h2>
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-savron-black border-2 border-savron-green/30 relative shrink-0">
                        {barber.image_url ? (
                            <Image src={barber.image_url} alt={barber.name} fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-savron-silver/70 text-3xl font-heading">
                                {barber.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <label className={cn(
                        "cursor-pointer px-5 py-3 text-[11px] uppercase tracking-widest border rounded-savron transition-all flex items-center gap-2",
                        uploadingProfile
                            ? "border-savron-silver/20 text-savron-silver/70 cursor-wait"
                            : "border-white/10 text-savron-silver hover:text-white hover:bg-white/5"
                    )}>
                        {uploadingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingProfile ? 'Uploading...' : 'Change Photo'}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePicChange}
                            className="hidden"
                            disabled={uploadingProfile}
                        />
                    </label>
                </div>
            </section>

            {/* Instagram */}
            <section className="card-savron space-y-5">
                <div>
                    <h2 className="font-heading uppercase tracking-widest text-white text-sm">Instagram</h2>
                    <p className="text-savron-silver/50 text-xs mt-1">Shown on your public booking page.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-savron-silver/40 text-sm select-none">@</span>
                        <input
                            type="text"
                            value={instagramHandle}
                            onChange={e => setInstagramHandle(e.target.value.replace(/^@/, ''))}
                            placeholder="yourhandle"
                            className="w-full bg-savron-charcoal border border-white/10 text-white placeholder-white/25 pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-savron-green/50 transition-all rounded-savron"
                        />
                    </div>
                    <button
                        onClick={handleSaveInstagram}
                        disabled={savingInstagram}
                        className="px-5 py-3 text-[11px] uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 hover:bg-savron-green-light rounded-savron transition-all disabled:opacity-50"
                    >
                        {savingInstagram ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </section>

            {/* Portfolio gallery */}
            <section className="card-savron space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="font-heading uppercase tracking-widest text-white text-sm">Portfolio</h2>
                        <p className="text-savron-silver/50 text-xs mt-1">
                            {(barber.portfolio_images?.length ?? 0)} image{(barber.portfolio_images?.length ?? 0) !== 1 ? 's' : ''} · Shown to clients on your booking page
                        </p>
                    </div>
                    <label className={cn(
                        "cursor-pointer px-5 py-3 text-[11px] uppercase tracking-widest border rounded-savron transition-all flex items-center gap-2",
                        uploadingPortfolio
                            ? "border-savron-silver/20 text-savron-silver/70 cursor-wait"
                            : "border-white/10 text-savron-silver hover:text-white hover:bg-white/5"
                    )}>
                        {uploadingPortfolio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingPortfolio ? 'Uploading...' : 'Add Photos'}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePortfolioAdd}
                            className="hidden"
                            disabled={uploadingPortfolio}
                        />
                    </label>
                </div>

                {(barber.portfolio_images?.length ?? 0) === 0 ? (
                    <div className="py-12 text-center border border-dashed border-white/10 rounded-savron">
                        <ImageIcon className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                        <p className="text-savron-silver/70 text-xs uppercase tracking-widest">No portfolio images yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {barber.portfolio_images!.map((url) => (
                            <div key={url} className="relative aspect-square rounded-savron overflow-hidden bg-savron-black border border-white/5 group">
                                <Image src={url} alt="Portfolio" fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                                <button
                                    onClick={() => removePortfolioImage(url)}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                    aria-label="Remove image"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Google Calendar Sync */}
            <section className="card-savron space-y-5">
                <div>
                    <h2 className="font-heading uppercase tracking-widest text-white text-sm">Calendar Sync</h2>
                    <p className="text-savron-silver/50 text-xs mt-1">
                        Connect your Google Calendar so we can automatically block out times when you are busy.
                    </p>
                </div>
                
                <div className="flex items-center gap-4 p-4 border border-white/5 bg-white/[0.02] rounded-savron">
                    <div className="w-10 h-10 rounded-full bg-savron-green/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-savron-green" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-white font-medium">Google Calendar</p>
                        <p className="text-xs text-savron-silver/70">
                            {/* @ts-ignore - Dynamic field check */}
                            {barber.google_calendar_tokens ? 'Connected securely' : 'Not connected'}
                        </p>
                    </div>
                    <button
                        onClick={handleConnectGoogle}
                        disabled={linkingGoogle}
                        className={cn(
                            "px-4 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all font-bold",
                            /* @ts-ignore */
                            barber.google_calendar_tokens
                                ? "border-white/10 text-white/50 hover:bg-white/5"
                                : "bg-savron-green border border-savron-green-light/20 text-white hover:bg-savron-green-light",
                            linkingGoogle && "opacity-50 cursor-wait"
                        )}
                    >
                        {linkingGoogle ? 'Connecting...' : /* @ts-ignore */ barber.google_calendar_tokens ? 'Reconnect' : 'Connect'}
                    </button>
                </div>
            </section>
        </motion.div>
    );
}
