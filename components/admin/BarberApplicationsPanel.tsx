"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ClipboardList, ExternalLink, Mail, Phone, RefreshCw, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Applicant } from '@/lib/types';

const STATUS_STYLES: Record<Applicant['status'], string> = {
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    interview: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    approved: 'bg-savron-green/10 text-accent-blue border-savron-green/25',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const ACTIVE_STATUSES: Applicant['status'][] = ['pending', 'interview'];

export default function BarberApplicationsPanel() {
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const loadApplicants = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/applicants/admin', { credentials: 'include' });
            const data = await res.json() as { applicants?: Applicant[]; error?: string };
            if (!res.ok) {
                setError(data.error ?? 'Failed to load applications');
                setApplicants([]);
                return;
            }
            setApplicants(data.applicants ?? []);
        } catch {
            setError('Failed to load applications');
            setApplicants([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadApplicants();
    }, []);

    const updateStatus = async (id: string, status: Applicant['status']) => {
        setUpdatingId(id);
        try {
            const res = await fetch('/api/applicants/admin', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            const data = await res.json() as { applicant?: Applicant; error?: string };
            if (!res.ok || !data.applicant) {
                setError(data.error ?? 'Failed to update application');
                return;
            }
            setApplicants(prev => prev.map(a => a.id === id ? data.applicant! : a));
            setError(null);
        } catch {
            setError('Failed to update application');
        } finally {
            setUpdatingId(null);
        }
    };

    const activeApplications = applicants.filter(a => ACTIVE_STATUSES.includes(a.status));
    const pendingCount = applicants.filter(a => a.status === 'pending').length;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-savron bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                            Barber Applications
                        </p>
                        <p className="text-sm text-savron-silver/60">
                            {loading
                                ? 'Loading…'
                                : `${activeApplications.length} open application${activeApplications.length !== 1 ? 's' : ''}${pendingCount ? ` · ${pendingCount} new` : ''}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={loadApplicants}
                        disabled={loading}
                        className="admin-action-btn px-3 py-2 border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all disabled:opacity-40"
                        title="Refresh applications"
                    >
                        <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                    </button>
                    <Link
                        href="/admin/applicants"
                        className="admin-action-btn px-4 py-2 border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all text-[10px] uppercase tracking-widest"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Full pipeline
                    </Link>
                </div>
            </div>

            {error && (
                <div className="px-4 py-3 border border-red-500/20 bg-red-500/5 rounded-savron text-red-300 text-xs">
                    {error}
                </div>
            )}

            {!loading && activeApplications.length === 0 && !error && (
                <div className="card-savron text-center py-10 px-6">
                    <p className="text-savron-silver/60 text-sm">No open barber applications right now.</p>
                    <p className="text-savron-silver/40 text-xs mt-2">
                        New submissions from <Link href="/join" className="text-savron-blue-light hover:underline">/join</Link> appear here.
                    </p>
                </div>
            )}

            {activeApplications.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                    {activeApplications.map(applicant => (
                        <div
                            key={applicant.id}
                            className="card-savron border-amber-500/20 space-y-4 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/60 via-amber-400/30 to-transparent" />
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="text-white font-heading uppercase tracking-wider text-sm truncate">
                                        {applicant.name}
                                    </h3>
                                    <p className="text-savron-silver/50 text-[10px] mt-1">
                                        Applied {format(new Date(applicant.created_at), 'MMM d, yyyy')}
                                    </p>
                                </div>
                                <span className={cn(
                                    'shrink-0 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border',
                                    STATUS_STYLES[applicant.status],
                                )}>
                                    {applicant.status}
                                </span>
                            </div>

                            {applicant.email && (
                                <p className="text-savron-silver/50 text-xs truncate flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 shrink-0" /> {applicant.email}
                                </p>
                            )}
                            {applicant.phone && (
                                <p className="text-savron-silver/70 text-xs flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 shrink-0" /> {applicant.phone}
                                </p>
                            )}
                            {applicant.experience_summary && (
                                <p className="text-savron-silver/50 text-xs leading-relaxed line-clamp-2">
                                    {applicant.experience_summary}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2 pt-1">
                                {applicant.status === 'pending' && (
                                    <button
                                        type="button"
                                        disabled={updatingId === applicant.id}
                                        onClick={() => updateStatus(applicant.id, 'interview')}
                                        className="admin-action-btn flex-1 border border-blue-500/25 text-blue-300 hover:bg-blue-500/10 rounded-savron text-[10px] uppercase tracking-widest"
                                    >
                                        Interview
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={updatingId === applicant.id}
                                    onClick={() => updateStatus(applicant.id, 'approved')}
                                    className="admin-action-btn flex-1 bg-savron-green/15 hover:bg-savron-green/25 border border-savron-green/30 text-accent-blue rounded-savron text-[10px] uppercase tracking-widest"
                                >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    Approve
                                </button>
                                <Link
                                    href="/admin/applicants"
                                    className="admin-action-btn px-3 border border-white/10 text-savron-silver hover:text-white rounded-savron"
                                    title="View full application"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
