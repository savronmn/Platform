'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, Loader2, CheckCircle2, AlertCircle, Eye, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutreachProspect } from '@/lib/outreach-prospects';
import {
    type OutreachEmailContent,
    type OutreachTemplateId,
    OUTREACH_MERGE_TAG_HINT,
    getDefaultContent,
    mergeVarsFromProspect,
    renderOutreachEmail,
} from '@/lib/outreach-email-templates';

type SendStatus = 'idle' | 'loading' | 'success' | 'error';

interface Props {
    open: boolean;
    selectedCount: number;
    reachableEmailCount: number;
    previewProspect: OutreachProspect | null;
    onClose: () => void;
    onSent: () => void;
    prospectIds: string[];
}

function paragraphsToText(paragraphs: string[]) {
    return paragraphs.join('\n\n');
}

function textToParagraphs(text: string) {
    return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
}

function bulletsToText(bullets?: string[]) {
    return (bullets ?? []).join('\n');
}

function textToBullets(text: string) {
    return text.split('\n').map(l => l.trim()).filter(Boolean);
}

export default function OutreachCampaignModal({
    open,
    selectedCount,
    reachableEmailCount,
    previewProspect,
    onClose,
    onSent,
    prospectIds,
}: Props) {
    const [templateId, setTemplateId] = useState<OutreachTemplateId>('chair_rental');
    const [content, setContent] = useState<OutreachEmailContent>(() => getDefaultContent('chair_rental'));
    const [campaignName, setCampaignName] = useState('Chair Rental Outreach');
    const [bodyText, setBodyText] = useState(() => getDefaultContent('chair_rental').bodyParagraphs.join('\n\n'));
    const [bulletsText, setBulletsText] = useState(() => (getDefaultContent('chair_rental').bulletPoints ?? []).join('\n'));
    const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
    const [sendError, setSendError] = useState<string | null>(null);
    const [campaignResult, setCampaignResult] = useState<{ sent: number; failed: number; errors?: string[] } | null>(null);
    const [testStatus, setTestStatus] = useState<SendStatus>('idle');
    const [testMessage, setTestMessage] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(true);

    const previewVars = useMemo(
        () => mergeVarsFromProspect(
            previewProspect?.name ?? 'Marcus Johnson',
            previewProspect?.businessName ?? 'Fade Factory MPLS',
        ),
        [previewProspect],
    );

    const builtContent = useMemo((): OutreachEmailContent => ({
        ...content,
        templateId,
        campaignName: campaignName.trim() || undefined,
        bodyParagraphs: textToParagraphs(bodyText),
        bulletPoints: templateId === 'chair_rental' ? textToBullets(bulletsText) : undefined,
    }), [content, templateId, campaignName, bodyText, bulletsText]);

    const preview = useMemo(
        () => renderOutreachEmail(builtContent, previewVars),
        [builtContent, previewVars],
    );

    useEffect(() => {
        if (!open) return;
        setSendStatus('idle');
        setSendError(null);
        setCampaignResult(null);
        setTestStatus('idle');
        setTestMessage(null);
    }, [open]);

    function switchTemplate(next: OutreachTemplateId) {
        setTemplateId(next);
        const defaults = getDefaultContent(next);
        setContent(defaults);
        setBodyText(paragraphsToText(defaults.bodyParagraphs));
        setBulletsText(bulletsToText(defaults.bulletPoints));
        if (!campaignName) {
            setCampaignName(next === 'chair_rental' ? 'Chair Rental Outreach' : 'Custom Outreach');
        }
    }

    function resetToDefault() {
        switchTemplate(templateId);
        setCampaignName(templateId === 'chair_rental' ? 'Chair Rental Outreach' : 'Custom Outreach');
    }

    async function sendTestToSelf() {
        if (!builtContent.subject.trim() || !builtContent.headline.trim() || !bodyText.trim()) {
            setTestStatus('error');
            setTestMessage('Subject, headline, and message body are required.');
            return;
        }

        setTestStatus('loading');
        setTestMessage(null);

        try {
            const res = await fetch('/api/email/outreach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospectIds,
                    content: builtContent,
                    htmlSnapshot: preview.html,
                    testToSelf: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setTestStatus('error');
                setTestMessage(data.error || 'Test send failed');
                return;
            }
            setTestStatus('success');
            setTestMessage(data.message || `Test sent to ${data.sentTo}`);
            onSent();
        } catch {
            setTestStatus('error');
            setTestMessage('Network error — could not reach the server');
        }
    }

    async function sendCampaign() {
        if (!builtContent.subject.trim() || !builtContent.headline.trim() || !bodyText.trim()) {
            setSendStatus('error');
            setSendError('Subject, headline, and message body are required.');
            return;
        }

        setSendStatus('loading');
        setSendError(null);
        setCampaignResult(null);

        try {
            const res = await fetch('/api/email/outreach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospectIds,
                    content: builtContent,
                    htmlSnapshot: preview.html,
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
            onSent();
        } catch {
            setSendStatus('error');
            setSendError('Network error — could not reach the server');
        }
    }

    if (!open) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }}
                    className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 p-5 border-b border-white/10 shrink-0">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 mb-1">Email Campaign</p>
                            <h2 className="text-lg text-white uppercase tracking-wider">
                                Send to {selectedCount} barber{selectedCount !== 1 ? 's' : ''}
                            </h2>
                            <p className="text-xs text-savron-silver/60 mt-1">
                                From: bookings@savronmn.com · Reply-To: savronmn@gmail.com · Tags: {OUTREACH_MERGE_TAG_HINT}
                            </p>
                            <p className="text-xs text-savron-silver/50 mt-1">
                                {reachableEmailCount} of {selectedCount} selected have a reachable email.
                                {reachableEmailCount === 0 && ' Use "Send test to me" to verify your template first.'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowPreview(v => !v)}
                                className={cn('admin-icon-btn text-xs gap-1.5 flex items-center px-3', showPreview && 'text-accent-blue')}
                            >
                                <Eye className="w-4 h-4" />
                                <span className="hidden sm:inline uppercase tracking-widest">{showPreview ? 'Hide' : 'Show'} Preview</span>
                            </button>
                            <button type="button" onClick={onClose} className="admin-icon-btn">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
                        {/* Editor */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-white/10">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Campaign name</label>
                                <input
                                    type="text"
                                    value={campaignName}
                                    onChange={e => setCampaignName(e.target.value)}
                                    placeholder="e.g. March Chair Rental Push"
                                    className="input-savron"
                                />
                            </div>

                            <div className="flex gap-2">
                                {(['chair_rental', 'custom'] as OutreachTemplateId[]).map(id => (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => switchTemplate(id)}
                                        className={cn(
                                            'flex-1 py-2.5 text-[10px] uppercase tracking-widest border rounded-savron transition-all',
                                            templateId === id
                                                ? 'bg-savron-green border-savron-green-light/20 text-white'
                                                : 'border-white/10 text-savron-silver hover:border-white/20 hover:text-white',
                                        )}
                                    >
                                        {id === 'chair_rental' ? 'Chair Rental' : 'Custom'}
                                    </button>
                                ))}
                                <button type="button" onClick={resetToDefault} title="Reset to default" className="admin-icon-btn px-3">
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Subject line</label>
                                <input
                                    type="text"
                                    value={content.subject}
                                    onChange={e => setContent(c => ({ ...c, subject: e.target.value }))}
                                    className="input-savron"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Kicker (small label)</label>
                                    <input
                                        type="text"
                                        value={content.kicker ?? ''}
                                        onChange={e => setContent(c => ({ ...c, kicker: e.target.value }))}
                                        className="input-savron"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Headline</label>
                                    <input
                                        type="text"
                                        value={content.headline}
                                        onChange={e => setContent(c => ({ ...c, headline: e.target.value }))}
                                        className="input-savron"
                                    />
                                </div>
                            </div>

                            {templateId === 'chair_rental' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Intro paragraph</label>
                                    <textarea
                                        value={content.intro ?? ''}
                                        onChange={e => setContent(c => ({ ...c, intro: e.target.value }))}
                                        rows={2}
                                        className="input-savron resize-none"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Message body</label>
                                <textarea
                                    value={bodyText}
                                    onChange={e => setBodyText(e.target.value)}
                                    rows={templateId === 'chair_rental' ? 4 : 8}
                                    placeholder="Separate paragraphs with a blank line…"
                                    className="input-savron resize-none font-mono text-sm"
                                />
                            </div>

                            {templateId === 'chair_rental' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Bullet points (one per line)</label>
                                        <textarea
                                            value={bulletsText}
                                            onChange={e => setBulletsText(e.target.value)}
                                            rows={4}
                                            className="input-savron resize-none font-mono text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Closing paragraph</label>
                                        <textarea
                                            value={content.closingParagraph ?? ''}
                                            onChange={e => setContent(c => ({ ...c, closingParagraph: e.target.value }))}
                                            rows={2}
                                            className="input-savron resize-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Button text</label>
                                            <input
                                                type="text"
                                                value={content.ctaText ?? ''}
                                                onChange={e => setContent(c => ({ ...c, ctaText: e.target.value }))}
                                                className="input-savron"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Button link</label>
                                            <input
                                                type="text"
                                                value={content.ctaHref ?? ''}
                                                onChange={e => setContent(c => ({ ...c, ctaHref: e.target.value }))}
                                                className="input-savron"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-savron-silver/50">Signature</label>
                                <input
                                    type="text"
                                    value={content.signature ?? ''}
                                    onChange={e => setContent(c => ({ ...c, signature: e.target.value }))}
                                    className="input-savron"
                                />
                            </div>
                        </div>

                        {/* Preview */}
                        {showPreview && (
                            <div className="w-full lg:w-[min(420px,45%)] flex flex-col bg-black/40 shrink-0">
                                <div className="px-4 py-3 border-b border-white/10 shrink-0">
                                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/50">Live preview</p>
                                    <p className="text-xs text-white mt-1 truncate">Subject: {preview.subject}</p>
                                    <p className="text-[10px] text-savron-silver/50 mt-0.5">
                                        Sample: {previewVars.firstName} · {previewVars.businessName}
                                    </p>
                                </div>
                                <div className="flex-1 min-h-[280px] lg:min-h-0 overflow-hidden p-3">
                                    <iframe
                                        title="Email preview"
                                        srcDoc={preview.html}
                                        className="w-full h-full min-h-[260px] rounded-savron border border-white/10 bg-[#050505]"
                                        sandbox=""
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-white/10 space-y-3 shrink-0">
                        {testStatus === 'loading' && (
                            <div className="flex items-center gap-3 text-xs text-savron-silver uppercase tracking-widest">
                                <Loader2 className="w-4 h-4 animate-spin" /> Sending test email…
                            </div>
                        )}
                        {testStatus === 'success' && testMessage && (
                            <div className="flex items-start gap-3 p-3 border border-savron-green/30 rounded-savron bg-savron-green/10 text-sm text-accent-blue">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <span>{testMessage}</span>
                            </div>
                        )}
                        {testStatus === 'error' && testMessage && (
                            <div className="flex items-start gap-3 p-3 border border-red-500/30 rounded-savron bg-red-500/10 text-sm text-red-300">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{testMessage}</span>
                            </div>
                        )}
                        {sendStatus === 'loading' && (
                            <div className="flex items-center gap-3 text-xs text-savron-silver uppercase tracking-widest">
                                <Loader2 className="w-4 h-4 animate-spin" /> Sending emails…
                            </div>
                        )}
                        {sendStatus === 'success' && campaignResult && (
                            <div className="flex items-start gap-3 p-3 border border-savron-green/30 rounded-savron bg-savron-green/10 text-sm text-accent-blue">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <span>{campaignResult.sent} sent{campaignResult.failed > 0 && ` · ${campaignResult.failed} failed`}</span>
                            </div>
                        )}
                        {sendStatus === 'error' && (
                            <div className="flex items-start gap-3 p-3 border border-red-500/30 rounded-savron bg-red-500/10 text-sm text-red-300">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <div>
                                    <p>{sendError}</p>
                                    {campaignResult?.errors?.map((e, i) => (
                                        <p key={i} className="text-[10px] font-mono mt-1 opacity-70">{e}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => void sendTestToSelf()}
                                disabled={sendStatus === 'loading' || testStatus === 'loading'}
                                className="flex-1 py-3 text-xs uppercase tracking-widest border border-white/10 text-savron-silver rounded-savron hover:border-accent-blue/30 hover:text-accent-blue transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {testStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                Send Test to Me
                            </button>
                            <button
                                type="button"
                                onClick={() => void sendCampaign()}
                                disabled={sendStatus === 'loading' || testStatus === 'loading' || reachableEmailCount === 0}
                                className="flex-1 py-3 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {sendStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Send Campaign ({reachableEmailCount})</>}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
