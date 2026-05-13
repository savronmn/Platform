"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ExternalLink, ChevronDown, UserCheck, Clock, X, FileVideo, Phone, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Applicant } from '@/lib/types';

const STATUS_STYLES: Record<Applicant['status'], string> = {
    pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    interview: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    approved:  'bg-savron-green/10 text-savron-green border-savron-green/20',
    rejected:  'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_OPTIONS: Applicant['status'][] = ['pending', 'interview', 'approved', 'rejected'];

export default function AdminApplicantsPage() {
    const supabase = createClient();
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Applicant | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    useEffect(() => {
        if (!openDropdown) return;
        const close = () => setOpenDropdown(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [openDropdown]);

    useEffect(() => {
        async function load() {
            const { data } = await supabase
                .from('applicants')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) setApplicants(data);
            setLoading(false);
        }
        load();
    }, []);

    const updateStatus = async (id: string, status: Applicant['status']) => {
        await supabase.from('applicants').update({ status }).eq('id', id);
        setApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    };

    const deleteApplicant = async (applicant: Applicant) => {
        setDeletingId(applicant.id);
        await supabase.from('applicants').delete().eq('id', applicant.id);
        setApplicants(prev => prev.filter(a => a.id !== applicant.id));
        setDeletingId(null);
        setConfirmDelete(null);
    };

    const counts = {
        pending:   applicants.filter(a => a.status === 'pending').length,
        interview: applicants.filter(a => a.status === 'interview').length,
        approved:  applicants.filter(a => a.status === 'approved').length,
        rejected:  applicants.filter(a => a.status === 'rejected').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">

            {/* Header */}
            <div>
                <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Hiring Pipeline</h1>
                <p className="text-savron-silver text-sm mt-1">
                    {applicants.length} application{applicants.length !== 1 ? 's' : ''} total
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {STATUS_OPTIONS.map(s => (
                    <div key={s} className="bg-savron-grey border border-white/5 rounded-savron p-4">
                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1">{s}</p>
                        <p className={cn("text-2xl font-mono font-bold",
                            s === 'pending'   ? 'text-amber-400' :
                            s === 'interview' ? 'text-blue-400' :
                            s === 'approved'  ? 'text-savron-green' : 'text-red-400'
                        )}>{counts[s]}</p>
                    </div>
                ))}
            </div>

            {/* Applicant list */}
            {applicants.length === 0 ? (
                <p className="text-savron-silver/60 text-sm">No applications yet.</p>
            ) : (
                <div className="space-y-3">
                    {applicants.map(a => (
                        <motion.div
                            key={a.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="bg-savron-grey border border-white/5 rounded-savron p-5"
                        >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                {/* Left: identity */}
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="font-heading text-white uppercase tracking-wider">{a.name}</h3>
                                        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border", STATUS_STYLES[a.status])}>
                                            {a.status}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-xs text-savron-silver/60">
                                        <span>{a.email}</span>
                                        {a.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> {a.phone}
                                            </span>
                                        )}
                                        {a.ig_handle && (
                                            <span className="flex items-center gap-1">
                                                <Instagram className="w-3 h-3" /> {a.ig_handle}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-[10px] text-savron-silver/70 uppercase tracking-wider">
                                        <span>{a.license_status}</span>
                                        <span>·</span>
                                        <span>{a.experience}</span>
                                        <span>·</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(a.created_at), 'MMM d, yyyy')}
                                        </span>
                                    </div>
                                </div>

                                {/* Right: actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {a.video_url && (
                                        <a
                                            href={a.video_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white hover:border-white/25 transition-all rounded-savron"
                                        >
                                            <FileVideo className="w-3.5 h-3.5" /> Video
                                            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                        </a>
                                    )}

                                    {/* Status dropdown */}
                                    <div className="relative">
                                        <button
                                            onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === a.id ? null : a.id); }}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                                                STATUS_STYLES[a.status]
                                            )}
                                        >
                                            <UserCheck className="w-3.5 h-3.5" />
                                            {a.status}
                                            <ChevronDown className={cn("w-3 h-3 transition-transform", openDropdown === a.id && "rotate-180")} />
                                        </button>
                                        <AnimatePresence>
                                            {openDropdown === a.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                    transition={{ duration: 0.1 }}
                                                    className="absolute right-0 top-full mt-1 w-36 bg-savron-charcoal border border-white/10 rounded-savron overflow-hidden z-20 shadow-xl"
                                                >
                                                    {STATUS_OPTIONS.filter(s => s !== a.status).map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => { updateStatus(a.id, s); setOpenDropdown(null); }}
                                                            className="w-full text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-savron-silver hover:text-white hover:bg-white/5 transition-colors"
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <button
                                        onClick={() => setConfirmDelete(a)}
                                        className="p-2 text-savron-silver/70 hover:text-red-400 hover:bg-red-500/5 border border-white/5 hover:border-red-500/20 rounded-savron transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {a.notes && (
                                <p className="mt-3 pt-3 border-t border-white/5 text-savron-silver/50 text-xs leading-relaxed">
                                    {a.notes}
                                </p>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Delete confirmation modal */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setConfirmDelete(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-white/10 rounded-savron p-6 w-full max-w-sm shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <h3 className="font-heading text-white uppercase tracking-wider">Delete Application</h3>
                                <button onClick={() => setConfirmDelete(null)} className="text-savron-silver hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-savron-silver text-sm mb-6">
                                Permanently delete <span className="text-white font-medium">{confirmDelete.name}</span>&apos;s application? This cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => deleteApplicant(confirmDelete)}
                                    disabled={deletingId === confirmDelete.id}
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 rounded-savron transition-all disabled:opacity-50"
                                >
                                    {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
