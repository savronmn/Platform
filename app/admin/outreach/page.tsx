"use client";

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Mail, Target, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutreachProspect, OutreachArea } from '@/lib/outreach-prospects';
import { OUTREACH_AREA_LABELS } from '@/lib/outreach-prospects';

type OutreachTemplate = 'chair_rental' | 'custom';
type SendStatus = 'idle' | 'loading' | 'success' | 'error';

const AREA_FILTERS: { key: OutreachArea; label: string }[] = [
    { key: 'all', label: 'All Areas' },
    { key: 'north_minneapolis', label: 'North MPLS' },
    { key: 'south_minneapolis', label: 'South MPLS' },
    { key: 'downtown', label: 'Downtown' },
    { key: 'northeast', label: 'Northeast' },
    { key: 'st_paul', label: 'St. Paul' },
    { key: 'suburbs', label: 'Suburbs' },
];

export default function OutreachPage() {
    const [prospects, setProspects] = useState<OutreachProspect[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [areaFilter, setAreaFilter] = useState<OutreachArea>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showCampaign, setShowCampaign] = useState(false);
    const [campaignTemplate, setCampaignTemplate] = useState<OutreachTemplate>('chair_rental');
    const [campaignSubject, setCampaignSubject] = useState('');
    const [campaignMessage, setCampaignMessage] = useState('');
    const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
    const [campaignResult, setCampaignResult] = useState<{ sent: number; failed: number; errors?: string[] } | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);

    useEffect(() => { fetchProspects(); }, []);

    async function fetchProspects() {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch('/api/outreach/prospects');
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to load prospects');
            }
            const data = await res.json();
            setProspects(data.prospects ?? []);
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load prospects');
        }
        setLoading(false);
    }

    const filteredProspects = useMemo(() => {
        let result = prospects;
        if (areaFilter !== 'all') {
            result = result.filter(p => p.area === areaFilter);
        }
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(s) ||
                p.email.toLowerCase().includes(s) ||
                p.businessName.toLowerCase().includes(s) ||
                p.area.toLowerCase().includes(s),
            );
        }
        return result;
    }, [prospects, areaFilter, search]);

    const allSelected = filteredProspects.length > 0 && selectedIds.size === filteredProspects.length;

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function selectAllFiltered() {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProspects.map(p => p.id)));
        }
    }

    function openCampaign() {
        setShowCampaign(true);
        setSendStatus('idle');
        setCampaignResult(null);
        setSendError(null);
    }

    function closeCampaign() {
        setShowCampaign(false);
        setSendStatus('idle');
        setCampaignResult(null);
        setSendError(null);
    }

    async function sendCampaign() {
        if (selectedIds.size === 0) return;
        setSendStatus('loading');
        setCampaignResult(null);
        setSendError(null);

        try {
            const res = await fetch('/api/email/outreach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospectIds: Array.from(selectedIds),
                    template: campaignTemplate,
                    subject: campaignSubject,
                    message: campaignMessage,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setSendStatus('error');
                setSendError(data.error || 'Failed to send campaign');
                return;
            }

            setCampaignResult({ sent: data.sent || 0, failed: data.failed || 0, errors: data.errors });
            setSendStatus(data.failed > 0 && data.sent === 0 ? 'error' : 'success');
        } catch {
            setSendStatus('error');
            setSendError('Network error — could not reach the server');
        }
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div>
                    <p className="admin-kicker">Prospecting</p>
                    <h1 className="admin-title">Outreach Control</h1>
                    <p className="admin-subtitle">
                        Send cold emails to barbers offering SAVRON&apos;s chair rental model.
                        Data is seed-only for now — Apify/Apollo import coming soon.
                    </p>
                </div>
                {selectedIds.size > 0 && (
                    <button
                        onClick={openCampaign}
                        className="admin-action-btn flex items-center gap-2 shrink-0"
                    >
                        <Mail className="w-4 h-4" />
                        Send Campaign ({selectedIds.size})
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="card-savron flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-savron-silver/50" />
                    <input
                        type="text"
                        placeholder="SEARCH BARBER PROSPECTS..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSelectedIds(new Set()); }}
                        className="input-savron pl-12"
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {AREA_FILTERS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => { setAreaFilter(key); setSelectedIds(new Set()); }}
                            className={cn(
                                "px-3 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                                areaFilter === key
                                    ? "bg-savron-green border border-savron-green-light/20 text-white"
                                    : "text-savron-silver border-white/10 hover:border-white/20 hover:text-white",
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-savron-silver/60">
                <span className="flex items-center gap-1.5">
                    <Target className="w-3 h-3" />
                    {filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''}
                </span>
                {selectedIds.size > 0 && (
                    <span className="text-accent-blue">{selectedIds.size} selected</span>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="card-savron flex items-center justify-center gap-3 py-16 text-savron-silver">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs uppercase tracking-widest">Loading prospects...</span>
                </div>
            )}

            {/* Fetch error */}
            {!loading && fetchError && (
                <div className="card-savron flex items-center gap-3 p-6 border-red-500/30 bg-red-500/10 text-red-300">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="text-sm font-medium">Failed to load prospects</p>
                        <p className="text-xs text-red-300/70 mt-1">{fetchError}</p>
                    </div>
                    <button onClick={fetchProspects} className="ml-auto text-xs uppercase tracking-widest underline hover:no-underline">
                        Retry
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!loading && !fetchError && filteredProspects.length === 0 && (
                <div className="card-savron text-center py-16 text-savron-silver/60">
                    <Target className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p className="text-xs uppercase tracking-widest">No prospects match your filters</p>
                </div>
            )}

            {/* Desktop table */}
            {!loading && !fetchError && filteredProspects.length > 0 && (
                <div className="hidden md:block card-savron overflow-x-auto p-0 min-w-0">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-4 py-4 w-10">
                                    <input type="checkbox" checked={allSelected} onChange={selectAllFiltered} className="admin-checkbox" />
                                </th>
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Name</th>
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Business</th>
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Area</th>
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Email</th>
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProspects.map(p => (
                                <tr
                                    key={p.id}
                                    className={cn(
                                        "border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer",
                                        selectedIds.has(p.id) && "bg-savron-green/5",
                                    )}
                                    onClick={() => toggleSelect(p.id)}
                                >
                                    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="admin-checkbox" />
                                    </td>
                                    <td className="px-4 py-4 text-sm text-white">{p.name}</td>
                                    <td className="px-4 py-4 text-sm text-savron-silver">{p.businessName}</td>
                                    <td className="px-4 py-4 text-xs text-savron-silver/70 uppercase tracking-wider">
                                        {OUTREACH_AREA_LABELS[p.area]}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-savron-silver/80">{p.email}</td>
                                    <td className="px-4 py-4">
                                        <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border border-white/10 text-savron-silver/60">
                                            {p.source}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Mobile cards */}
            {!loading && !fetchError && filteredProspects.length > 0 && (
                <div className="md:hidden space-y-3">
                    {filteredProspects.map(p => (
                        <div
                            key={p.id}
                            onClick={() => toggleSelect(p.id)}
                            className={cn(
                                "card-savron cursor-pointer transition-all",
                                selectedIds.has(p.id) && "border-savron-green/30 bg-savron-green/5",
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(p.id)}
                                    onChange={() => toggleSelect(p.id)}
                                    onClick={e => e.stopPropagation()}
                                    className="admin-checkbox mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white font-medium">{p.name}</p>
                                    <p className="text-xs text-savron-silver mt-0.5">{p.businessName}</p>
                                    <p className="text-xs text-savron-silver/60 mt-1">{p.email}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] uppercase tracking-widest text-savron-silver/50">
                                            {OUTREACH_AREA_LABELS[p.area]}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 text-savron-silver/50">
                                            {p.source}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Campaign modal */}
            <AnimatePresence>
                {showCampaign && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={closeCampaign}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-lg p-6 space-y-5"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1">Outreach Campaign</p>
                                    <h2 className="text-lg text-white uppercase tracking-wider">Send to {selectedIds.size} Barber{selectedIds.size !== 1 ? 's' : ''}</h2>
                                    <p className="text-xs text-savron-silver/60 mt-1">
                                        From: info@savronmn.com · Reply-To: savronmn@gmail.com
                                    </p>
                                </div>
                                <button onClick={closeCampaign} className="admin-icon-btn">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Template selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Template</label>
                                <div className="flex gap-2">
                                    {([
                                        ['chair_rental', 'Chair Rental'],
                                        ['custom', 'Custom Message'],
                                    ] as [OutreachTemplate, string][]).map(([key, label]) => (
                                        <button
                                            key={key}
                                            onClick={() => setCampaignTemplate(key)}
                                            className={cn(
                                                "flex-1 py-2.5 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                                                campaignTemplate === key
                                                    ? "bg-savron-green border-savron-green-light/20 text-white"
                                                    : "border-white/10 text-savron-silver hover:border-white/20 hover:text-white",
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {campaignTemplate === 'custom' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Subject</label>
                                        <input
                                            type="text"
                                            value={campaignSubject}
                                            onChange={e => setCampaignSubject(e.target.value)}
                                            placeholder="Email subject line..."
                                            className="input-savron"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Message</label>
                                        <textarea
                                            value={campaignMessage}
                                            onChange={e => setCampaignMessage(e.target.value)}
                                            placeholder="Write your outreach message..."
                                            rows={5}
                                            className="input-savron resize-none"
                                        />
                                    </div>
                                </>
                            )}

                            {campaignTemplate === 'chair_rental' && (
                                <div className="p-4 border border-white/10 rounded-savron bg-white/[0.02] text-xs text-savron-silver/70 leading-relaxed">
                                    Sends the pre-built <strong className="text-white/80">Chair Rental Opportunity</strong> template introducing SAVRON&apos;s flexible rental model, booking support, and lounge environment.
                                </div>
                            )}

                            {/* Status feedback */}
                            {sendStatus === 'loading' && (
                                <div className="flex items-center gap-3 p-4 border border-white/10 rounded-savron bg-white/[0.02]">
                                    <Loader2 className="w-4 h-4 animate-spin text-accent-blue" />
                                    <span className="text-xs uppercase tracking-widest text-savron-silver">Sending emails...</span>
                                </div>
                            )}

                            {sendStatus === 'success' && campaignResult && (
                                <div className="flex items-start gap-3 p-4 border border-savron-green/30 rounded-savron bg-savron-green/10">
                                    <CheckCircle2 className="w-5 h-5 text-accent-blue shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-accent-blue font-medium">Campaign sent successfully</p>
                                        <p className="text-xs text-savron-silver/70 mt-1">
                                            {campaignResult.sent} email{campaignResult.sent !== 1 ? 's' : ''} delivered
                                            {campaignResult.failed > 0 && ` · ${campaignResult.failed} failed`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {sendStatus === 'error' && (
                                <div className="flex items-start gap-3 p-4 border border-red-500/30 rounded-savron bg-red-500/10">
                                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-red-300 font-medium">Campaign failed</p>
                                        <p className="text-xs text-red-300/70 mt-1">
                                            {sendError || (campaignResult ? `${campaignResult.failed} of ${campaignResult.sent + campaignResult.failed} failed` : 'Unknown error')}
                                        </p>
                                        {campaignResult?.errors && campaignResult.errors.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {campaignResult.errors.map((e, i) => (
                                                    <li key={i} className="text-[10px] text-red-300/60 font-mono">{e}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={sendCampaign}
                                disabled={sendStatus === 'loading' || (campaignTemplate === 'custom' && !campaignSubject.trim())}
                                className="w-full py-3 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {sendStatus === 'loading'
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <><Mail className="w-4 h-4" /> Send Campaign</>
                                }
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
