"use client";

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Upload, Check, AlertCircle, X } from 'lucide-react';

export default function PortalPage() {
    const supabase = createClient();
    const fileRef = useRef<HTMLInputElement>(null);
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

    function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // 2-minute validation (AI_RULES requirement)
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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setStatus('submitting');
        setError('');

        // Luxury delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            let video_url: string | null = null;

            // Upload video if provided
            if (videoFile) {
                const fileName = `${Date.now()}_${videoFile.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('applicant-videos')
                    .upload(fileName, videoFile);

                if (uploadError) {
                    // Fallback: store without video if bucket doesn't exist
                    console.warn('Video upload failed (bucket may not exist):', uploadError.message);
                } else {
                    const { data: urlData } = supabase.storage
                        .from('applicant-videos')
                        .getPublicUrl(fileName);
                    video_url = urlData.publicUrl;
                }
            }

            // Reject duplicate email
            const { data: existing } = await supabase
                .from('applicants')
                .select('id')
                .eq('email', form.email.toLowerCase().trim())
                .maybeSingle();
            if (existing) {
                setError('An application with this email already exists.');
                setStatus('error');
                return;
            }

            // Insert applicant
            const { error: insertError } = await supabase.from('applicants').insert({
                ...form,
                email: form.email.toLowerCase().trim(),
                video_url,
                status: 'pending',
            });

            if (insertError) throw insertError;

            setStatus('success');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setStatus('error');
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
                    <div className="w-16 h-16 bg-savron-green rounded-full flex items-center justify-center mx-auto">
                        <Check className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Application Received</h1>
                    <p className="text-savron-silver">
                        Thank you for your interest in joining SAVRON. We review all portfolios and will contact qualified candidates within 48 hours.
                    </p>
                    <p className="text-savron-silver/50 text-xs uppercase tracking-widest">SAVRON Recruitment</p>
                </motion.div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-savron-black pt-20">
            {/* Hero */}
            <section className="relative py-24 px-6 md:px-12 lg:px-24 overflow-hidden">
                <div className="absolute inset-0 opacity-15 bg-[url('https://images.unsplash.com/photo-1593702295094-aea8c5c13d8d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
                <div className="relative z-10 max-w-3xl mx-auto text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="relative w-40 h-10 mx-auto mb-8">
                            <Image src="/logo.png" alt="SAVRON" fill className="object-contain" priority />
                        </div>
                        <h1 className="font-heading text-5xl md:text-7xl uppercase tracking-widest text-white">
                            Join the <span className="text-emerald-400">Craft</span>
                        </h1>
                        <p className="text-savron-silver text-lg font-light max-w-xl mx-auto">
                            We seek elite barbers who are obsessed with detail and dedicated to the art of grooming.
                            If you believe you have what it takes to uphold the SAVRON standard, show us your work.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Form */}
            <section className="py-16 px-6 md:px-12 lg:px-24">
                <div className="max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="space-y-10">
                        {/* Personal */}
                        <div className="space-y-4">
                            <h3 className="text-white font-heading uppercase tracking-widest text-sm border-b border-white/10 pb-2">Personal Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input required placeholder="FULL NAME" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="input-savron" />
                                <input required type="email" placeholder="EMAIL" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="input-savron" />
                                <input required type="tel" placeholder="PHONE" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} className="input-savron" />
                                <input placeholder="LOCATION" className="input-savron" />
                            </div>
                        </div>

                        {/* Professional */}
                        <div className="space-y-4">
                            <h3 className="text-white font-heading uppercase tracking-widest text-sm border-b border-white/10 pb-2">Professional Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select value={form.license_status} onChange={(e) => setForm(p => ({ ...p, license_status: e.target.value }))} className="input-savron">
                                    <option>Active Master Barber</option>
                                    <option>Active Cosmetologist</option>
                                    <option>Student / Apprentice</option>
                                    <option>Other</option>
                                </select>
                                <select value={form.experience} onChange={(e) => setForm(p => ({ ...p, experience: e.target.value }))} className="input-savron">
                                    <option value="">YEARS OF EXPERIENCE</option>
                                    <option>1-3 Years</option>
                                    <option>3-5 Years</option>
                                    <option>5-10 Years</option>
                                    <option>10+ Years</option>
                                </select>
                            </div>
                            <textarea
                                required
                                placeholder="BRIEF SUMMARY OF YOUR EXPERIENCE"
                                value={form.experience_summary}
                                onChange={(e) => setForm(p => ({ ...p, experience_summary: e.target.value }))}
                                className="input-savron w-full h-28 resize-none py-3"
                            />
                        </div>

                        {/* Social Proof */}
                        <div className="space-y-4">
                            <h3 className="text-white font-heading uppercase tracking-widest text-sm border-b border-white/10 pb-2">Social Proof</h3>
                            <input placeholder="INSTAGRAM HANDLE (@)" value={form.ig_handle} onChange={(e) => setForm(p => ({ ...p, ig_handle: e.target.value }))} className="input-savron" />
                        </div>

                        {/* Video Upload */}
                        <div className="space-y-4">
                            <h3 className="text-white font-heading uppercase tracking-widest text-sm border-b border-white/10 pb-2">Video Introduction</h3>
                            <p className="text-savron-silver/60 text-xs uppercase tracking-wider">Max 2 minutes. Show us your best work.</p>

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
                                <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-white/10 rounded-savron cursor-pointer hover:border-savron-green/30 transition-colors">
                                    <Upload className="w-8 h-8 text-savron-silver/30 mb-3" />
                                    <span className="text-savron-silver/50 text-xs uppercase tracking-widest">Click to upload video</span>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="video/*"
                                        onChange={handleVideoSelect}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-xs uppercase tracking-wider">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={status === 'submitting'}
                            className="w-full py-4 bg-savron-green text-white font-heading uppercase tracking-widest text-sm rounded-savron hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {status === 'submitting' ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Submit Application'
                            )}
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}
