"use client";

import { Button } from '@/components/ui/Button';
import { useState } from 'react';

const ApplicationForm = () => {
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('submitting');
        // Simulate API call
        setTimeout(() => {
            setStatus('success');
        }, 2000);
    };

    if (status === 'success') {
        return (
            <div className="bg-savron-green/10 border border-savron-green/30 p-8 rounded-sm text-center">
                <h3 className="text-white font-heading text-2xl uppercase tracking-wider mb-4">Application Received</h3>
                <p className="text-savron-silver mb-8">
                    Thank you for your interest in joining the SAVRON team. We review all portfolios and will contact qualified candidates within 48 hours.
                </p>
                <Button variant="outline" onClick={() => setStatus('idle')}>Submit Another Application</Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Details */}
            <div className="space-y-4">
                <h3 className="text-white font-heading uppercase tracking-wider text-sm border-b border-white/10 pb-2">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-savron-silver">Full Name</label>
                        <input required type="text" className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-savron-silver">Email Address</label>
                        <input required type="email" className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-savron-silver">Phone Number</label>
                        <input required type="tel" className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-savron-silver">Location</label>
                        <input required type="text" className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors" />
                    </div>
                </div>
            </div>

            {/* Professional Details */}
            <div className="space-y-4">
                <h3 className="text-white font-heading uppercase tracking-wider text-sm border-b border-white/10 pb-2">Professional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-savron-silver">License Status</label>
                        <select className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors appearance-none">
                            <option>Active Master Barber</option>
                            <option>Active Cosmetologist</option>
                            <option>Student / Apprentice</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-savron-silver">Years of Experience</label>
                        <select className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors appearance-none">
                            <option>1-3 Years</option>
                            <option>3-5 Years</option>
                            <option>5-10 Years</option>
                            <option>10+ Years</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-savron-silver">Brief Summary of Experience</label>
                    <textarea required className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors h-28 resize-none" placeholder="Tell us about your experience..." />
                </div>
            </div>

            {/* Social Proof */}
            <div className="space-y-4">
                <h3 className="text-white font-heading uppercase tracking-wider text-sm border-b border-white/10 pb-2">Social Proof</h3>
                <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-savron-silver">Instagram Handle (@)</label>
                    <input required type="text" placeholder="@" className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-savron-silver">Portfolio / Video Link</label>
                    <input type="url" placeholder="https://" className="w-full bg-savron-black border border-white/20 text-white p-3 outline-none focus:border-savron-green transition-colors" />
                    <p className="text-xs text-savron-silver/50">Link to a video introduction or digital portfolio.</p>
                </div>
            </div>

            <div className="pt-4">
                <Button type="submit" size="lg" className="w-full" isLoading={status === 'submitting'}>
                    Submit Application
                </Button>
            </div>
        </form>
    );
};

export default ApplicationForm;
