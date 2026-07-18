"use client";

import { useEffect, useState, useMemo } from 'react';
import { Search, Mail, Target, CheckCircle2, AlertCircle, Loader2, Radar, History, Star, ChevronDown, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutreachProspect, OutreachArea } from '@/lib/outreach-prospects';
import { OUTREACH_AREA_LABELS } from '@/lib/outreach-prospects';
import OutreachCampaignModal from '@/components/admin/OutreachCampaignModal';
import type { OutreachEmailContent } from '@/lib/outreach-email-templates';

type ImportStatus = 'idle' | 'loading' | 'success' | 'error';

interface OutreachSendLog {
    id: string;
    sentByEmail: string | null;
    template: string;
    subject: string | null;
    campaignName: string | null;
    emailContent: OutreachEmailContent | null;
    htmlSnapshot: string | null;
    prospectCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
}
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
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
    const [apifyConfigured, setApifyConfigured] = useState(false);
    const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [sendHistory, setSendHistory] = useState<OutreachSendLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [scanArea, setScanArea] = useState<OutreachArea>('all');
    const [minYears, setMinYears] = useState('3');
    const [minPrice, setMinPrice] = useState('25');
    const [maxPrice, setMaxPrice] = useState('100');
    const [minRating, setMinRating] = useState('4.0');
    const [includeSavronBarbers, setIncludeSavronBarbers] = useState(true);

    useEffect(() => {
        void fetchProspects();
        void fetchHistory();
    }, []);

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
            setApifyConfigured(Boolean(data.apifyConfigured));
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load prospects');
        }
        setLoading(false);
    }

    async function fetchHistory() {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/outreach/history');
            if (res.ok) {
                const data = await res.json();
                setSendHistory(data.sends ?? []);
            }
        } catch {
            // History is non-blocking
        }
        setHistoryLoading(false);
    }

    async function runBarberScan() {
        if (!apifyConfigured) {
            setImportStatus('error');
            setImportMessage('Set APIFY_API_TOKEN in Vercel environment variables to run barber scans.');
            return;
        }

        setImportStatus('loading');
        setImportMessage('Scanning Google Maps, websites, and reviews — this can take 2–5 minutes…');

        try {
            const res = await fetch('/api/outreach/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    area: scanArea,
                    minYearsExperience: minYears ? Number(minYears) : undefined,
                    minPriceDollars: minPrice ? Number(minPrice) : undefined,
                    maxPriceDollars: maxPrice ? Number(maxPrice) : undefined,
                    minRating: minRating ? Number(minRating) : undefined,
                    includeSavronBarbers,
                    enrichWebsites: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Barber scan failed');
            }
            setProspects(data.prospects ?? []);
            setImportStatus('success');
            setImportMessage(data.message || `Scan found ${data.matched ?? 0} barbers.`);
        } catch (err) {
            setImportStatus('error');
            setImportMessage(err instanceof Error ? err.message : 'Barber scan failed');
        }
    }

    function formatPrice(cents?: number | null) {
        if (cents == null) return '—';
        return `$${(cents / 100).toFixed(0)}`;
    }

    function formatPriceRange(p: OutreachProspect) {
        if (p.priceMinCents == null && p.priceMaxCents == null) return '—';
        if (p.priceMinCents != null && p.priceMaxCents != null && p.priceMinCents !== p.priceMaxCents) {
            return `${formatPrice(p.priceMinCents)}–${formatPrice(p.priceMaxCents)}`;
        }
        return formatPrice(p.priceMinCents ?? p.priceMaxCents);
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
    }

    const previewProspect = useMemo(() => {
        const firstId = Array.from(selectedIds)[0];
        return prospects.find(p => p.id === firstId) ?? filteredProspects[0] ?? null;
    }, [selectedIds, prospects, filteredProspects]);

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div>
                    <p className="admin-kicker">Prospecting</p>
                    <h1 className="admin-title">Outreach Control</h1>
                    <p className="admin-subtitle">
                        Scan the web for barber prospects by experience, pricing, and Google Maps reputation — then send chair rental outreach.
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

            {/* Barber scan panel */}
            <div className="card-savron space-y-5 border-savron-green/20">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-savron bg-savron-green/10 border border-savron-green/20">
                        <Radar className="w-5 h-5 text-accent-blue" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-sm uppercase tracking-widest text-white">Barber Web Scan</h2>
                        <p className="text-xs text-savron-silver/70 mt-1 leading-relaxed">
                            Uses Apify to search Google Maps, scrape shop websites for prices &amp; experience, and pull review reputation.
                            Includes SAVRON barbers already in your database.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Min years experience</label>
                        <input type="number" min={0} max={40} value={minYears} onChange={e => setMinYears(e.target.value)} className="input-savron" placeholder="3" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Min price ($)</label>
                        <input type="number" min={0} value={minPrice} onChange={e => setMinPrice(e.target.value)} className="input-savron" placeholder="25" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Max price ($)</label>
                        <input type="number" min={0} value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="input-savron" placeholder="100" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Min Google rating</label>
                        <input type="number" min={0} max={5} step={0.1} value={minRating} onChange={e => setMinRating(e.target.value)} className="input-savron" placeholder="4.0" />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex gap-1.5 flex-wrap flex-1">
                        {AREA_FILTERS.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setScanArea(key)}
                                className={cn(
                                    'px-3 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all',
                                    scanArea === key
                                        ? 'bg-savron-green border-savron-green-light/20 text-white'
                                        : 'text-savron-silver border-white/10 hover:border-white/20 hover:text-white',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-savron-silver/70 shrink-0 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeSavronBarbers}
                            onChange={e => setIncludeSavronBarbers(e.target.checked)}
                            className="admin-checkbox"
                        />
                        Include SAVRON barbers
                    </label>
                </div>

                <button
                    type="button"
                    onClick={() => void runBarberScan()}
                    disabled={importStatus === 'loading'}
                    className="w-full sm:w-auto px-8 py-3 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                    {importStatus === 'loading'
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning barbers…</>
                        : <><Radar className="w-4 h-4" /> Run Barber Scan</>
                    }
                </button>
            </div>

            {(importStatus === 'success' || importStatus === 'error') && importMessage && (
                <div className={cn(
                    'card-savron flex items-start gap-3 p-4 text-sm',
                    importStatus === 'success' ? 'border-savron-green/30 bg-savron-green/10 text-accent-blue' : 'border-red-500/30 bg-red-500/10 text-red-300',
                )}>
                    {importStatus === 'success'
                        ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                        : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                    <p>{importMessage}</p>
                </div>
            )}

            {!apifyConfigured && (
                <div className="card-savron p-4 text-xs text-savron-silver/70 border-amber-500/20 bg-amber-500/5">
                    Add <code className="text-white/80">APIFY_API_TOKEN</code> in Vercel to enable web scans. Seed / saved prospects are shown below until then.
                </div>
            )}

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
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Rating</th>
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Exp.</th>
                                <th className="px-4 py-4 text-[10px] uppercase tracking-widest text-savron-silver/50 font-normal">Price</th>
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
                                    <td className="px-4 py-4 text-sm text-white">
                                        {p.name}
                                        {p.isSavronBarber && (
                                            <span className="ml-2 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-savron-green/30 text-accent-blue">SAVRON</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-savron-silver">{p.businessName}</td>
                                    <td className="px-4 py-4 text-xs text-savron-silver/70 uppercase tracking-wider">
                                        {OUTREACH_AREA_LABELS[p.area]}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-savron-silver/80">
                                        {p.rating != null ? (
                                            <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{p.rating.toFixed(1)}{p.reviewCount != null && <span className="text-savron-silver/50">({p.reviewCount})</span>}</span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-savron-silver/80">{p.yearsExperience != null ? `${p.yearsExperience}y` : '—'}</td>
                                    <td className="px-4 py-4 text-sm text-savron-silver/80">{formatPriceRange(p)}</td>
                                    <td className="px-4 py-4 text-sm text-savron-silver/80">{p.email || '—'}</td>
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
                                    <p className="text-sm text-white font-medium">
                                        {p.name}
                                        {p.isSavronBarber && <span className="ml-2 text-[9px] uppercase tracking-widest text-accent-blue">SAVRON</span>}
                                    </p>
                                    <p className="text-xs text-savron-silver mt-0.5">{p.businessName}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] uppercase tracking-widest text-savron-silver/50">
                                        {p.rating != null && <span>{p.rating.toFixed(1)}★</span>}
                                        {p.yearsExperience != null && <span>{p.yearsExperience}y exp</span>}
                                        {(p.priceMinCents != null || p.priceMaxCents != null) && <span>{formatPriceRange(p)}</span>}
                                    </div>
                                    <p className="text-xs text-savron-silver/60 mt-1">{p.email || 'No email'}</p>
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

            {/* Campaign history */}
            <div className="card-savron space-y-4">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-savron-silver/60" />
                    <h2 className="text-sm uppercase tracking-widest text-white">Campaign History</h2>
                </div>
                {historyLoading ? (
                    <div className="flex items-center gap-2 text-xs text-savron-silver/60 uppercase tracking-widest">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading history...
                    </div>
                ) : sendHistory.length === 0 ? (
                    <p className="text-xs text-savron-silver/60 uppercase tracking-widest">No outreach campaigns sent yet.</p>
                ) : (
                    <div className="space-y-1">
                        {sendHistory.map(entry => {
                            const expanded = expandedHistoryId === entry.id;
                            return (
                                <div key={entry.id} className="border border-white/5 rounded-savron overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedHistoryId(expanded ? null : entry.id)}
                                        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 text-left hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">
                                                {entry.campaignName || entry.subject || entry.template.replace('_', ' ')}
                                            </p>
                                            <p className="text-xs text-savron-silver/60 mt-0.5">
                                                {new Date(entry.createdAt).toLocaleString()} · {entry.sentByEmail || 'admin'}
                                                {entry.subject && entry.campaignName && (
                                                    <span className="hidden sm:inline"> · {entry.subject}</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <p className="text-xs uppercase tracking-widest text-savron-silver/70">
                                                {entry.sentCount} sent · {entry.failedCount} failed · {entry.prospectCount} selected
                                            </p>
                                            <ChevronDown className={cn('w-4 h-4 text-savron-silver/50 transition-transform', expanded && 'rotate-180')} />
                                        </div>
                                    </button>
                                    {expanded && entry.htmlSnapshot && (
                                        <div className="border-t border-white/5 p-4 bg-black/30">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Eye className="w-4 h-4 text-savron-silver/50" />
                                                <p className="text-[10px] uppercase tracking-widest text-savron-silver/50">Sent email preview</p>
                                            </div>
                                            <iframe
                                                title={`Campaign preview ${entry.id}`}
                                                srcDoc={entry.htmlSnapshot}
                                                className="w-full h-[420px] rounded-savron border border-white/10 bg-[#050505]"
                                                sandbox=""
                                            />
                                        </div>
                                    )}
                                    {expanded && !entry.htmlSnapshot && (
                                        <div className="border-t border-white/5 p-4 text-xs text-savron-silver/50">
                                            No HTML snapshot stored for this campaign.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <OutreachCampaignModal
                open={showCampaign}
                selectedCount={selectedIds.size}
                previewProspect={previewProspect}
                prospectIds={Array.from(selectedIds)}
                onClose={() => setShowCampaign(false)}
                onSent={() => void fetchHistory()}
            />
        </div>
    );
}
