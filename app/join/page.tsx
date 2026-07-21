"use client";

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    CheckCircle2,
    Scissors,
    ArrowRight,
    DollarSign,
    Wallet,
    Users,
    Calendar,
    Sparkles,
    BadgeCheck,
    Armchair,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const SPECIALTIES = [
    "Signature Fades", "Classic Cuts", "Hot Towel Shaves", "Beard Design",
    "Textured Styles", "Color Work", "Line-ups", "Kids Cuts", "Modern Cuts", "Executive Cut",
];

const CHAIR_BENEFITS = [
    {
        icon: DollarSign,
        title: 'Zero commission',
        description: 'Keep 100% of what you earn. We never take a cut of your services or tips.',
    },
    {
        icon: Wallet,
        title: 'Your payment methods',
        description: 'Cash, Venmo, Zelle, Square — however you already get paid, you keep doing it.',
    },
    {
        icon: Users,
        title: 'Your clients, your prices',
        description: 'Build your own book, set your own rates, and grow your brand under your name.',
    },
    {
        icon: Armchair,
        title: 'Rent a premium chair',
        description: 'Work inside a high-end lounge in downtown Minneapolis — not a commission shop.',
    },
    {
        icon: Calendar,
        title: 'Flexible schedule',
        description: 'Choose the days and hours that fit your life. No rigid shift requirements.',
    },
    {
        icon: Sparkles,
        title: 'Booking & marketing support',
        description: 'Online scheduling, client management, and exposure to SAVRON’s walk-in traffic.',
    },
];

export default function BarberRegistration() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleSpecialty = (s: string) =>
        setSelectedSpecialties(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
        );

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        if (selectedSpecialties.length > 0) {
            formData.append('specialties', selectedSpecialties.join(', '));
        }

        try {
            const res = await fetch('/api/barbers/register', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok && data.success) {
                setSuccess(true);
            } else {
                setError(data.error || 'Failed to submit registration');
            }
        } catch {
            setError('A network error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setImagePreview(URL.createObjectURL(file));
    };

    const inputCls = "w-full bg-white/[0.03] border border-white/[0.08] text-white placeholder-white/25 px-4 py-3.5 text-sm font-light tracking-wide focus:outline-none focus:border-savron-green/50 focus:bg-white/[0.05] transition-all rounded-savron";
    const labelCls = "block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1";

    return (
        <main className="min-h-screen bg-savron-black flex flex-col relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-savron-grey/30 rounded-full blur-[120px] mix-blend-overlay" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-savron-green/5 rounded-full blur-[100px] mix-blend-overlay" />
                <div className="absolute top-[35%] left-[50%] -translate-x-1/2 w-[40vw] h-[40vw] bg-savron-blue/5 rounded-full blur-[90px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 w-full py-6 px-6 flex justify-center border-b border-white/5 bg-black/20 backdrop-blur-md">
                <Link href="/" className="relative w-28 h-7 block">
                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain" priority />
                </Link>
            </header>

            <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12 relative z-10">
                <div className="w-full max-w-5xl">
                    <AnimatePresence mode="wait">
                        {success ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-savron-grey border border-white/10 p-10 md:p-14 text-center rounded-[24px] shadow-2xl max-w-2xl mx-auto"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                                    className="w-20 h-20 bg-savron-green/10 rounded-full flex items-center justify-center mx-auto mb-6 text-savron-blue-light"
                                >
                                    <CheckCircle2 size={40} />
                                </motion.div>
                                <h2 className="font-heading text-3xl text-white uppercase tracking-widest mb-4">
                                    Application Received
                                </h2>
                                <p className="text-savron-silver font-light leading-relaxed mb-8 max-w-md mx-auto text-sm">
                                    Thanks for applying to rent a chair at SAVRON. We&apos;ll review your profile and reach out to schedule a walkthrough of the space and the rental model.
                                </p>
                                <Link href="/" className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white text-xs uppercase tracking-widest hover:bg-white/10 transition-all rounded-savron">
                                    Return Home
                                </Link>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                {/* Hero */}
                                <section className="text-center max-w-3xl mx-auto">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-savron-green/30 bg-savron-green/10 text-savron-blue-light text-[10px] uppercase tracking-[0.25em] mb-5">
                                        <BadgeCheck size={12} />
                                        Chairs available · Minneapolis
                                    </div>
                                    <h1 className="font-heading text-3xl md:text-5xl text-white uppercase tracking-widest mb-4 leading-tight">
                                        Rent Your Chair at SAVRON
                                    </h1>
                                    <p className="text-savron-silver/80 font-light text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
                                        This isn&apos;t a commission job. You rent a chair in our premium lounge, keep every dollar you earn, and run your business your way — your clients, your prices, your payment methods.
                                    </p>
                                </section>

                                {/* Model explainer */}
                                <section className="rounded-[20px] border border-savron-green/20 bg-gradient-to-br from-savron-green/10 via-savron-grey/40 to-transparent p-5 md:p-6">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-savron-green/15 border border-savron-green/25 flex items-center justify-center text-savron-blue-light">
                                            <Scissors size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] uppercase tracking-[0.25em] text-savron-blue-light mb-2">
                                                How the model works
                                            </p>
                                            <p className="text-white/90 text-sm md:text-base font-light leading-relaxed">
                                                You pay a flat weekly chair rental — <span className="text-white font-normal">no commission, no revenue split, no hidden fees</span>.
                                                Every cut, every tip, every dollar goes straight to you. Use Cash App, Venmo, Zelle, card readers, or cash — whatever you already use. We provide the space, the vibe, and the tools to help you grow.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {/* Benefits grid */}
                                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                    {CHAIR_BENEFITS.map((benefit, i) => (
                                        <motion.div
                                            key={benefit.title}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="group rounded-[18px] border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-savron-green/25 p-4 md:p-5 transition-all"
                                        >
                                            <div className="w-9 h-9 rounded-full bg-savron-green/10 border border-savron-green/20 flex items-center justify-center text-savron-blue-light mb-3 group-hover:scale-105 transition-transform">
                                                <benefit.icon size={16} />
                                            </div>
                                            <h3 className="text-white text-sm font-medium mb-1.5">{benefit.title}</h3>
                                            <p className="text-savron-silver/70 text-xs leading-relaxed">{benefit.description}</p>
                                        </motion.div>
                                    ))}
                                </section>

                                {/* Application form */}
                                <section className="bg-savron-grey/80 backdrop-blur-xl border border-white/10 p-6 md:p-10 rounded-[24px] shadow-2xl">
                                    <div className="text-center mb-8">
                                        <p className="text-[10px] uppercase tracking-[0.3em] text-savron-blue-light mb-3 flex items-center justify-center gap-2">
                                            <Armchair size={12} /> Apply for a chair
                                        </p>
                                        <h2 className="font-heading text-xl md:text-2xl text-white uppercase tracking-widest mb-3">
                                            Tell Us About You
                                        </h2>
                                        <p className="text-savron-silver/70 font-light text-sm">
                                            Fill out your profile below. We&apos;re looking for skilled barbers who want independence — not a boss taking a cut.
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="mb-6 p-4 border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-light tracking-wide text-center rounded-savron">
                                            {error}
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        {/* Name + Email */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelCls}>Full Name *</label>
                                                <input type="text" name="name" required className={inputCls} placeholder="John Doe" />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Email Address *</label>
                                                <input type="email" name="email" required className={inputCls} placeholder="john@example.com" />
                                            </div>
                                        </div>

                                        {/* Password */}
                                        <div>
                                            <label className={labelCls}>Password (For your Barber Portal) *</label>
                                            <input type="password" name="password" required className={inputCls} placeholder="Min 8 characters" minLength={8} />
                                        </div>

                                        {/* Phone + Instagram */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelCls}>Phone Number</label>
                                                <input type="tel" name="phone" className={inputCls} placeholder="(612) 000-0000" />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Instagram</label>
                                                <input type="text" name="instagram_url" className={inputCls} placeholder="@yourhandle" />
                                            </div>
                                        </div>

                                        {/* Bio */}
                                        <div>
                                            <label className={labelCls}>Bio / About You</label>
                                            <textarea
                                                name="bio"
                                                rows={3}
                                                className={`${inputCls} resize-none`}
                                                placeholder="Tell us about your experience, your clientele, and why chair rental fits you..."
                                            />
                                        </div>

                                        {/* Specialties */}
                                        <div>
                                            <label className={labelCls}>Specialties (select all that apply)</label>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {SPECIALTIES.map(s => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => toggleSpecialty(s)}
                                                        className={cn(
                                                            "px-3 py-2 rounded-savron text-[11px] uppercase tracking-wider border transition-all",
                                                            selectedSpecialties.includes(s)
                                                                ? "bg-savron-green border border-savron-green-light/20 text-white"
                                                                : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white/80"
                                                        )}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Photo upload */}
                                        <div>
                                            <label className={labelCls}>Profile Photo (optional)</label>
                                            <div className="relative group cursor-pointer">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    name="image"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                />
                                                <div className="border-2 border-dashed border-white/10 rounded-savron p-6 flex flex-col items-center justify-center text-center group-hover:border-savron-green/40 group-hover:bg-white/[0.02] transition-all relative overflow-hidden min-h-[100px]">
                                                    {imagePreview ? (
                                                        <div className="absolute inset-0">
                                                            <Image src={imagePreview} alt="Preview" fill unoptimized className="object-cover opacity-60" />
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Upload size={18} className="text-white mb-1" />
                                                                <span className="text-[10px] uppercase tracking-widest text-white font-medium">Change Photo</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                                <Upload size={18} className="text-white/50 group-hover:text-savron-green" />
                                                            </div>
                                                            <span className="text-xs text-white/50 uppercase tracking-widest group-hover:text-white transition-colors">Upload Photo</span>
                                                            <span className="text-[10px] text-white/30 mt-1">JPG, PNG, WebP · Max 5MB</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Submit */}
                                        <div className="pt-2">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-savron-green text-white border border-savron-green-light/20 text-xs font-bold uppercase tracking-[0.2em] hover:bg-savron-green-light transition-all rounded-savron disabled:opacity-50 group"
                                            >
                                                {loading ? 'Submitting…' : 'Apply for a Chair'}
                                                {!loading && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                                            </button>
                                            <p className="text-center text-[10px] text-white/30 tracking-widest mt-4">
                                                By applying you agree to SAVRON&apos;s terms and conditions.
                                            </p>
                                        </div>
                                    </form>
                                </section>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </main>
    );
}
