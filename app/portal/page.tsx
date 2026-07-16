"use client";

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Upload, Check, AlertCircle, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepId =
    | 'intro'
    | 'name'
    | 'email'
    | 'phone'
    | 'license'
    | 'experience'
    | 'summary'
    | 'instagram'
    | 'video'
    | 'review';

const STEPS: StepId[] = [
    'intro', 'name', 'email', 'phone', 'license', 'experience', 'summary', 'instagram', 'video', 'review',
];

const STEP_LABELS: Record<StepId, string> = {
    intro: 'Welcome',
    name: 'Your name',
    email: 'Email',
    phone: 'Phone',
    license: 'License',
    experience: 'Experience',
    summary: 'Background',
    instagram: 'Instagram',
    video: 'Video',
    review: 'Review',
};

export default function PortalPage() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<StepId>('intro');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        ig_handle: '',
        experience: '',
        license_status: 'Active Master Barber',
        experience_summary: '',
    });

    const stepIndex = STEPS.indexOf(step);
    const progress = step === 'intro' ? 0 : Math.round((stepIndex / (STEPS.length - 1)) * 100);

    function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 120) {
                setError('Video must be 2 minutes or less.');
                setVideoFile(null);
                setVideoPreview(null);
                return;
            }
            setError('');
            setVideoFile(file);
            setVideoPreview(URL.createObjectURL(file));
        };
        video.src = URL.createObjectURL(file);
    }

    function removeVideo() {
        setVideoFile(null);
        setVideoPreview(null);
        if (fileRef.current) fileRef.current.value = '';
    }

    function validateCurrentStep(): string | null {
        switch (step) {
            case 'name':
                if (!form.name.trim()) return 'Please enter your full name.';
                break;
            case 'email':
                if (!form.email.trim()) return 'Please enter your email.';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email.';
                break;
            case 'phone':
                if (!form.phone.trim()) return 'Please enter your phone number.';
                break;
            case 'experience':
                if (!form.experience) return 'Please select your years of experience.';
                break;
            case 'summary':
                if (!form.experience_summary.trim()) return 'Please tell us about your experience.';
                break;
            default:
                break;
        }
        return null;
    }

    function goNext() {
        const validationError = validateCurrentStep();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError('');
        const next = STEPS[stepIndex + 1];
        if (next) setStep(next);
    }

    function goBack() {
        setError('');
        const prev = STEPS[stepIndex - 1];
        if (prev) setStep(prev);
    }

    async function handleSubmit() {
        setStatus('submitting');
        setError('');

        try {
            const body = new FormData();
            body.append('name', form.name.trim());
            body.append('email', form.email.trim());
            body.append('phone', form.phone.trim());
            body.append('ig_handle', form.ig_handle.trim());
            body.append('experience', form.experience);
            body.append('license_status', form.license_status);
            body.append('experience_summary', form.experience_summary.trim());
            if (videoFile) body.append('video', videoFile);

            const res = await fetch('/api/applicants/apply', { method: 'POST', body });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setError(data.error || 'Something went wrong. Please try again.');
                setStatus('error');
                setStep('review');
                return;
            }

            setStatus('success');
        } catch {
            setError('Network error. Please check your connection and try again.');
            setStatus('error');
            setStep('review');
        }
    }

    if (status === 'success') {
        return (
            <main className="min-h-screen bg-savron-black flex items-center justify-center px-4 pt-20">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center max-w-lg space-y-6"
                >
                    <div className="w-16 h-16 bg-savron-blue rounded-full flex items-center justify-center mx-auto">
                        <Check className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Application Received</h1>
                    <p className="text-savron-silver text-base leading-relaxed">
                        Thank you for your interest in joining SAVRON. We review all portfolios and will contact qualified candidates within 48 hours.
                    </p>
                    <p className="text-savron-silver/80 text-xs uppercase tracking-widest">SAVRON Recruitment</p>
                </motion.div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-savron-black pt-20">
            <section className="relative py-16 px-6 md:px-12 lg:px-24">
                <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1593702295094-aea8c5c13d8d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
                <div className="relative z-10 max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                        <div className="relative w-36 h-9 mx-auto mb-6">
                            <Image src="/logo.png" alt="SAVRON" fill className="object-contain" priority />
                        </div>
                        <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl uppercase tracking-widest text-white">
                            Join the Team
                        </h1>
                        <p className="text-savron-silver text-base font-light max-w-lg mx-auto mt-4 leading-relaxed">
                            Elite barbers who care about detail and the art of grooming. Answer a few questions — takes about 5 minutes.
                        </p>
                    </div>

                    {step !== 'intro' && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-savron-silver mb-2">
                                <span>{STEP_LABELS[step]}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-savron-blue-light transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="bg-savron-grey border border-white/10 rounded-savron p-6 sm:p-8 min-h-[320px] flex flex-col">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.25 }}
                                className="flex-1 flex flex-col"
                            >
                                {step === 'intro' && (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-8">
                                        <p className="text-savron-silver text-base leading-relaxed max-w-md">
                                            We&apos;ll ask about your background, license, experience, and optionally a short video of your work.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={goNext}
                                            className="px-8 py-4 bg-savron-blue text-white font-heading uppercase tracking-widest text-sm rounded-savron hover:bg-savron-blue-light transition-all glow-blue"
                                        >
                                            Start Application
                                        </button>
                                    </div>
                                )}

                                {step === 'name' && (
                                    <QuestionStep
                                        title="What's your full name?"
                                        subtitle="As it appears on your license."
                                    >
                                        <input
                                            autoFocus
                                            placeholder="FULL NAME"
                                            value={form.name}
                                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                            className="input-savron"
                                            onKeyDown={e => e.key === 'Enter' && goNext()}
                                        />
                                    </QuestionStep>
                                )}

                                {step === 'email' && (
                                    <QuestionStep title="What's your email?" subtitle="We'll use this to follow up.">
                                        <input
                                            autoFocus
                                            type="email"
                                            placeholder="EMAIL"
                                            value={form.email}
                                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                            className="input-savron"
                                            onKeyDown={e => e.key === 'Enter' && goNext()}
                                        />
                                    </QuestionStep>
                                )}

                                {step === 'phone' && (
                                    <QuestionStep title="What's your phone number?" subtitle="Best number to reach you.">
                                        <input
                                            autoFocus
                                            type="tel"
                                            placeholder="PHONE"
                                            value={form.phone}
                                            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                            className="input-savron"
                                            onKeyDown={e => e.key === 'Enter' && goNext()}
                                        />
                                    </QuestionStep>
                                )}

                                {step === 'license' && (
                                    <QuestionStep title="What's your license status?" subtitle="Select the option that fits best.">
                                        <select
                                            value={form.license_status}
                                            onChange={e => setForm(p => ({ ...p, license_status: e.target.value }))}
                                            className="input-savron"
                                        >
                                            <option>Active Master Barber</option>
                                            <option>Active Cosmetologist</option>
                                            <option>Student / Apprentice</option>
                                            <option>Other</option>
                                        </select>
                                    </QuestionStep>
                                )}

                                {step === 'experience' && (
                                    <QuestionStep title="How many years of experience?" subtitle="Professional barbering experience.">
                                        <select
                                            value={form.experience}
                                            onChange={e => setForm(p => ({ ...p, experience: e.target.value }))}
                                            className="input-savron"
                                        >
                                            <option value="">Select years</option>
                                            <option>1-3 Years</option>
                                            <option>3-5 Years</option>
                                            <option>5-10 Years</option>
                                            <option>10+ Years</option>
                                        </select>
                                    </QuestionStep>
                                )}

                                {step === 'summary' && (
                                    <QuestionStep title="Tell us about your experience" subtitle="Cuts, specialties, shops you've worked at.">
                                        <textarea
                                            autoFocus
                                            placeholder="YOUR BACKGROUND"
                                            value={form.experience_summary}
                                            onChange={e => setForm(p => ({ ...p, experience_summary: e.target.value }))}
                                            className="input-savron w-full h-36 resize-none py-3"
                                        />
                                    </QuestionStep>
                                )}

                                {step === 'instagram' && (
                                    <QuestionStep title="Instagram handle?" subtitle="Optional — helps us see your work.">
                                        <input
                                            autoFocus
                                            placeholder="@YOURHANDLE"
                                            value={form.ig_handle}
                                            onChange={e => setForm(p => ({ ...p, ig_handle: e.target.value }))}
                                            className="input-savron"
                                            onKeyDown={e => e.key === 'Enter' && goNext()}
                                        />
                                    </QuestionStep>
                                )}

                                {step === 'video' && (
                                    <QuestionStep title="Video introduction" subtitle="Optional. Max 2 minutes — show us your best work.">
                                        {videoPreview ? (
                                            <div className="relative border border-white/10 rounded-savron overflow-hidden">
                                                <video src={videoPreview} controls className="w-full aspect-video object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={removeVideo}
                                                    className="absolute top-3 right-3 bg-black/60 border border-white/20 p-2 rounded-full hover:bg-red-500/30 transition-colors"
                                                >
                                                    <X className="w-4 h-4 text-white" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-white/15 rounded-savron cursor-pointer hover:border-savron-blue-light/40 transition-colors">
                                                <Upload className="w-8 h-8 text-savron-silver mb-3" />
                                                <span className="text-savron-silver text-sm uppercase tracking-widest">Tap to upload video</span>
                                                <input ref={fileRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
                                            </label>
                                        )}
                                    </QuestionStep>
                                )}

                                {step === 'review' && (
                                    <QuestionStep title="Review your application" subtitle="Everything look good?">
                                        <div className="space-y-3 text-sm">
                                            {[
                                                ['Name', form.name],
                                                ['Email', form.email],
                                                ['Phone', form.phone],
                                                ['License', form.license_status],
                                                ['Experience', form.experience],
                                                ['Instagram', form.ig_handle || '—'],
                                                ['Video', videoFile ? videoFile.name : 'Not provided'],
                                            ].map(([label, value]) => (
                                                <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                                                    <span className="text-savron-silver uppercase tracking-wider text-xs">{label}</span>
                                                    <span className="text-white text-right">{value}</span>
                                                </div>
                                            ))}
                                            <p className="text-savron-silver text-xs leading-relaxed pt-2">{form.experience_summary}</p>
                                        </div>
                                    </QuestionStep>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mt-4">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                            </div>
                        )}

                        {step !== 'intro' && (
                            <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={goBack}
                                    className="flex items-center gap-2 px-4 py-3 text-savron-silver text-xs uppercase tracking-widest hover:text-white transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Back
                                </button>

                                {step === 'review' ? (
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={status === 'submitting'}
                                        className="flex items-center gap-2 px-6 py-3 bg-savron-blue text-white font-heading uppercase tracking-widest text-xs rounded-savron hover:bg-savron-blue-light transition-all disabled:opacity-50"
                                    >
                                        {status === 'submitting' ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>Submit <Check className="w-4 h-4" /></>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={goNext}
                                        className="flex items-center gap-2 px-6 py-3 bg-savron-blue text-white font-heading uppercase tracking-widest text-xs rounded-savron hover:bg-savron-blue-light transition-all"
                                    >
                                        Continue <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}

function QuestionStep({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-6 flex-1">
            <div>
                <h2 className="font-heading text-xl sm:text-2xl uppercase tracking-widest text-white">{title}</h2>
                <p className="text-savron-silver text-sm mt-2">{subtitle}</p>
            </div>
            {children}
        </div>
    );
}
