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
    approved:  'bg-savron-green/10 text-emerald-400 border-savron-green/20',
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
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
    const [showArchived, setShowArchived] = useState(false);

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
        setSelectedApplicant(prev => prev && prev.id === id ? { ...prev, status } : prev);
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

    const ARCHIVED_STATUSES: Applicant['status'][] = ['approved', 'rejected'];
    const visibleApplicants = showArchived
        ? applicants
        : applicants.filter(a => !ARCHIVED_STATUSES.includes(a.status));
    const archivedCount = applicants.filter(a => ARCHIVED_STATUSES.includes(a.status)).length;

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
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Hiring Pipeline</h1>
                    <p className="text-savron-silver text-sm mt-1">
                        {visibleApplicants.length} application{visibleApplicants.length !== 1 ? 's' : ''} shown
                    </p>
                </div>
                {archivedCount > 0 && (
                    <button
                        onClick={() => setShowArchived(v => !v)}
                        className={cn(
                            "px-4 py-2 text-xs uppercase tracking-widest border rounded-savron transition-all font-medium",
                            showArchived
                                ? "bg-white/15 text-white border-white/30 hover:bg-white/20"
                                : "text-white border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30"
                        )}
                    >
                        {showArchived ? `Hide Archived (${archivedCount})` : `Show Archived (${archivedCount})`}
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {STATUS_OPTIONS.map(s => (
                    <div key={s} className="bg-savron-grey border border-white/5 rounded-savron p-4">
                        <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1">{s}</p>
                        <p className={cn("text-2xl font-mono font-bold",
                            s === 'pending'   ? 'text-amber-400' :
                            s === 'interview' ? 'text-blue-400' :
                            s === 'approved'  ? 'text-emerald-400' : 'text-red-400'
                        )}>{counts[s]}</p>
                    </div>
                ))}
            </div>

            {/* Applicant list */}
            {visibleApplicants.length === 0 ? (
                <p className="text-savron-silver/60 text-sm">
                    {applicants.length === 0 ? 'No applications yet.' : 'No active applications. Toggle "Show Archived" to view past ones.'}
                </p>
            ) : (
                <div className="space-y-3">
                    {visibleApplicants.map(a => (
                        <motion.div
                            key={a.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            onClick={() => setSelectedApplicant(a)}
                            className="bg-savron-grey border border-white/5 rounded-savron p-5 cursor-pointer hover:border-white/10 hover:bg-white/[0.01] transition-all"
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
                                            <a
                                                href={`https://instagram.com/${a.ig_handle.replace(/^@/, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="flex items-center gap-1 hover:text-white text-savron-silver/60 transition-colors"
                                            >
                                                <Instagram className="w-3 h-3" /> {a.ig_handle}
                                            </a>
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
                                            onClick={e => e.stopPropagation()}
                                            className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest border border-white/20 text-white bg-white/5 hover:bg-white/10 hover:border-white/40 transition-all rounded-savron font-medium"
                                        >
                                            <FileVideo className="w-3.5 h-3.5" /> Video
                                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
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
                                                            onClick={e => { e.stopPropagation(); updateStatus(a.id, s); setOpenDropdown(null); }}
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
                                        onClick={e => { e.stopPropagation(); setConfirmDelete(a); }}
                                        className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-savron transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {(a.experience_summary || a.notes) && (
                                <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                                    {a.experience_summary && (
                                        <p className="text-savron-silver/60 text-xs leading-relaxed line-clamp-1 italic">
                                            &ldquo;{a.experience_summary}&rdquo;
                                        </p>
                                    )}
                                    {a.notes && (
                                        <p className="text-savron-silver/40 text-[11px] leading-relaxed line-clamp-1">
                                            <strong className="text-savron-silver/50">Notes:</strong> {a.notes}
                                        </p>
                                    )}
                                </div>
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
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest border border-white/20 text-white bg-white/5 hover:bg-white/10 rounded-savron transition-all font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => deleteApplicant(confirmDelete)}
                                    disabled={deletingId === confirmDelete.id}
                                    className="flex-1 py-2.5 text-[11px] uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white border border-red-600/50 hover:border-red-700/50 rounded-savron transition-all disabled:opacity-50 font-medium"
                                >
                                    {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Applicant details modal */}
            <AnimatePresence>
                {selectedApplicant && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setSelectedApplicant(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            className="bg-savron-grey border border-white/10 rounded-savron p-6 md:p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh] space-y-6 scrollbar-thin"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h2 className="font-heading text-2xl text-white uppercase tracking-wider">{selectedApplicant.name}</h2>
                                        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border", STATUS_STYLES[selectedApplicant.status])}>
                                            {selectedApplicant.status}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-savron-silver/50 uppercase tracking-widest flex items-center gap-1 font-mono">
                                        <Clock className="w-3 h-3" /> Applied {format(new Date(selectedApplicant.created_at), 'MMMM d, yyyy · h:mm a')}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedApplicant(null)} className="text-savron-silver hover:text-white p-1 rounded hover:bg-white/5 transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left column: Contact info and Professional stats */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 block">Contact Information</span>
                                        <div className="space-y-1.5 text-sm text-white">
                                            <div className="flex items-center">
                                                <span className="text-savron-silver/60 text-xs inline-block w-20 shrink-0">Email:</span>
                                                <a href={`mailto:${selectedApplicant.email}`} className="text-emerald-400 hover:text-emerald-300 hover:underline truncate">
                                                    {selectedApplicant.email}
                                                </a>
                                            </div>
                                            <div className="flex items-center">
                                                <span className="text-savron-silver/60 text-xs inline-block w-20 shrink-0">Phone:</span>
                                                <a href={`tel:${selectedApplicant.phone}`} className="text-emerald-400 hover:text-emerald-300 hover:underline">
                                                    {selectedApplicant.phone}
                                                </a>
                                            </div>
                                            {selectedApplicant.ig_handle && (
                                                <div className="flex items-center">
                                                    <span className="text-savron-silver/60 text-xs inline-block w-20 shrink-0">Instagram:</span>
                                                    <a
                                                        href={`https://instagram.com/${selectedApplicant.ig_handle.replace(/^@/, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1"
                                                    >
                                                        {selectedApplicant.ig_handle} <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 block">Professional Details</span>
                                        <div className="space-y-1.5 text-sm text-white">
                                            <div className="flex items-center">
                                                <span className="text-savron-silver/60 text-xs inline-block w-28 shrink-0">Experience:</span>
                                                <span className="font-medium text-white">{selectedApplicant.experience}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <span className="text-savron-silver/60 text-xs inline-block w-28 shrink-0">License Status:</span>
                                                <span className="font-medium text-white">{selectedApplicant.license_status}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status selector directly on modal */}
                                    <div className="space-y-2 pt-2">
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 block">Set Pipeline Status</span>
                                        <div className="flex flex-wrap gap-2">
                                            {STATUS_OPTIONS.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => updateStatus(selectedApplicant.id, s)}
                                                    className={cn(
                                                        "px-2.5 py-1.5 rounded text-[10px] uppercase tracking-widest border transition-all font-medium",
                                                        selectedApplicant.status === s
                                                            ? STATUS_STYLES[s]
                                                            : "border-white/5 bg-white/[0.02] text-savron-silver/60 hover:text-white hover:border-white/20"
                                                    )}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right column: Video introduction */}
                                <div className="space-y-2">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 block">Video Introduction</span>
                                    {selectedApplicant.video_url ? (
                                        <div className="space-y-2">
                                            <video
                                                controls
                                                playsInline
                                                className="w-full aspect-video rounded-savron border border-white/10 bg-black object-cover shadow-inner"
                                                src={selectedApplicant.video_url}
                                            />
                                            <a
                                                href={selectedApplicant.video_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center justify-end gap-1 uppercase tracking-widest font-mono"
                                            >
                                                Open video in tab <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-video rounded-savron border border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center p-4">
                                            <FileVideo className="w-8 h-8 text-savron-silver/20 mb-2" />
                                            <span className="text-xs text-savron-silver/40 uppercase tracking-widest">No video submitted</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Experience Summary */}
                            <div className="space-y-2 pt-4 border-t border-white/5">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 block">Brief Summary of Experience</span>
                                <div className="text-savron-silver text-sm bg-white/[0.02] border border-white/5 rounded-savron p-4 leading-relaxed whitespace-pre-wrap font-light">
                                    {selectedApplicant.experience_summary || "No experience summary was provided for this application."}
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedApplicant.notes && (
                                <div className="space-y-2 pt-2">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-savron-silver/50 block">Internal Notes</span>
                                    <div className="text-savron-silver/70 text-sm bg-amber-500/[0.02] border border-amber-500/10 rounded-savron p-4 leading-relaxed whitespace-pre-wrap font-light">
                                        {selectedApplicant.notes}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-white/5 justify-end">
                                <button
                                    onClick={() => setSelectedApplicant(null)}
                                    className="px-5 py-2 text-[10px] uppercase tracking-widest border border-white/10 text-savron-silver hover:text-white rounded-savron transition-all"
                                >
                                    Close Details
                                </button>
                                <button
                                    onClick={() => {
                                        setConfirmDelete(selectedApplicant);
                                        setSelectedApplicant(null);
                                    }}
                                    className="px-5 py-2 text-[10px] uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-savron transition-all"
                                >
                                    Delete Application
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
