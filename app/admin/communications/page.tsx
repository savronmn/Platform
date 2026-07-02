"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Mail, Send, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Recipient = { email: string; name?: string };

export default function CommunicationsPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [targetGroup, setTargetGroup] = useState<'all' | 'clients' | 'subscribers'>('all');
    
    const [clients, setClients] = useState<Recipient[]>([]);
    const [subscribers, setSubscribers] = useState<Recipient[]>([]);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const [clientsRes, subsRes] = await Promise.all([
                supabase.from('clients').select('name, email'),
                supabase.from('email_subscribers').select('name, email')
            ]);
            
            if (clientsRes.data) {
                setClients(clientsRes.data.filter(c => c.email).map(c => ({ name: c.name, email: c.email! })));
            }
            if (subsRes.data) {
                setSubscribers(subsRes.data.filter(s => s.email).map(s => ({ name: s.name, email: s.email! })));
            }
            setLoading(false);
        }
        fetchData();
    }, []);

    // Get unique recipients based on target group
    const getActiveRecipients = () => {
        let pool: Recipient[] = [];
        if (targetGroup === 'clients' || targetGroup === 'all') pool = [...pool, ...clients];
        if (targetGroup === 'subscribers' || targetGroup === 'all') pool = [...pool, ...subscribers];
        
        // Deduplicate by email
        const unique = new Map<string, Recipient>();
        for (const r of pool) {
            unique.set(r.email.toLowerCase(), r);
        }
        return Array.from(unique.values());
    };

    const activeRecipients = getActiveRecipients();

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (activeRecipients.length === 0) {
            setErrorMsg('No valid email recipients found in this group.');
            setStatus('error');
            return;
        }

        setSending(true);
        setStatus('idle');
        setErrorMsg('');

        try {
            // Basic HTML wrapper for the email content
            const htmlContent = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <div style="text-align: center; padding: 20px 0;">
                        <img src="https://savronmn.com/logo.png" alt="SAVRON" style="max-height: 40px; background-color: #000; padding: 10px;" />
                    </div>
                    <div style="padding: 20px; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">
                        ${content}
                    </div>
                    <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; margin-top: 30px; font-size: 12px; color: #999;">
                        SAVRON Barbershop & Lounge &copy; ${new Date().getFullYear()}
                    </div>
                </div>
            `;

            const res = await fetch('/api/email/brevo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    htmlContent,
                    recipients: activeRecipients
                })
            });

            const data = await res.json();
            
            if (res.ok && data.success) {
                setStatus('success');
                setSubject('');
                setContent('');
            } else {
                setStatus('error');
                setErrorMsg(data.error || 'Failed to send campaign');
            }
        } catch (err) {
            setStatus('error');
            setErrorMsg('Network error. Please try again later.');
        } finally {
            setSending(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div>
                    <p className="admin-kicker">Campaigns</p>
                    <h1 className="admin-title">Communications</h1>
                    <p className="admin-subtitle">
                        Send mass emails to clients and subscribers via Brevo
                    </p>
                </div>
                <div className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-savron">
                    <Users size={14} className="text-savron-silver" />
                    <span className="text-[10px] uppercase tracking-widest text-white">
                        {activeRecipients.length} Target Recipients
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 card-savron">
                    <form onSubmit={handleSend} className="space-y-6">
                        <AnimatePresence>
                            {status === 'success' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    className="bg-savron-blue/10 border border-savron-blue/20 text-accent-blue p-4 rounded-savron flex items-center gap-3"
                                >
                                    <CheckCircle2 size={16} />
                                    <span className="text-xs uppercase tracking-widest">Campaign sent successfully via Brevo!</span>
                                </motion.div>
                            )}
                            {status === 'error' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-savron flex items-center gap-3"
                                >
                                    <AlertCircle size={16} />
                                    <span className="text-xs uppercase tracking-widest">{errorMsg}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">Target Audience</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                    { id: 'all', label: 'Everyone' },
                                    { id: 'clients', label: 'CRM Clients' },
                                    { id: 'subscribers', label: 'E-Pass Subscribers' },
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setTargetGroup(t.id as any)}
                                        className={`py-3 px-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all ${
                                            targetGroup === t.id 
                                            ? 'bg-savron-green text-white border border-savron-green-light/20' 
                                            : 'text-savron-silver border-white/10 hover:border-white/20 hover:text-white bg-white/5'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">Subject Line</label>
                            <input 
                                type="text" 
                                required 
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="input-savron"
                                placeholder="E.g. Special Holiday Offer from SAVRON"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">Email Content (Plain text supports paragraphs)</label>
                            <textarea 
                                required 
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                rows={10}
                                className="input-savron resize-none"
                                placeholder="Type your message here..."
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={sending || !subject || !content || activeRecipients.length === 0}
                            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-savron-green text-white border border-savron-green-light/20 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-savron-green-light transition-all rounded-savron disabled:opacity-50"
                        >
                            {sending ? 'Sending Campaign...' : `Send to ${activeRecipients.length} Recipients`}
                            {!sending && <Send size={14} />}
                        </button>
                    </form>
                </div>

                <div className="space-y-6">
                    <div className="card-savron">
                        <div className="flex items-center gap-3 mb-4">
                            <Mail className="text-savron-silver w-4 h-4" />
                            <h3 className="text-xs uppercase tracking-widest text-white">Brevo Integration</h3>
                        </div>
                        <p className="text-sm text-savron-silver/70 font-light leading-relaxed">
                            Emails are routed through the official Brevo API. This ensures high deliverability and protects your domain reputation.
                        </p>
                        <ul className="mt-4 space-y-2">
                            <li className="flex items-center justify-between text-xs font-light border-b border-white/5 pb-2">
                                <span className="text-savron-silver">Sender Email:</span>
                                <span className="text-white">info@savronmn.com</span>
                            </li>
                            <li className="flex items-center justify-between text-xs font-light border-b border-white/5 pb-2">
                                <span className="text-savron-silver">Sender Name:</span>
                                <span className="text-white">SAVRON Barbershop</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
