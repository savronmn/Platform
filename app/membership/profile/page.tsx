"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Client } from '@/lib/types';

export default function MemberProfilePage() {
    const supabase = createClient();
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Editable fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [preferences, setPreferences] = useState('');

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('clients')
                .select('*')
                .eq('auth_id', user.id)
                .single();

            if (data) {
                setClient(data);
                setName(data.name || '');
                setEmail(data.email || user.email || '');
                setPhone(data.phone || '');
                setPreferences(data.preferences || '');
            } else {
                // Fallback — use auth user's info
                setEmail(user.email || '');
            }
            setLoading(false);
        }
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        if (client) {
            await supabase
                .from('clients')
                .update({ name, phone, preferences })
                .eq('id', client.id);
        }
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-savron-grey border border-white/10 rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-savron-silver/40" />
                </div>
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">My Profile</h1>
                {client && (
                    <p className="text-savron-silver/50 text-xs uppercase tracking-widest">
                        Member since {new Date(client.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                )}
            </div>

            {/* Membership Badge */}
            {client && (
                <div className="bg-savron-grey border border-white/5 rounded-savron p-5 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/40 mb-1">Membership Tier</p>
                    <p className="text-white font-heading text-lg uppercase tracking-widest">
                        {client.membership_status === 'vip' ? '⭐ VIP' :
                         client.membership_status === 'inner_circle' ? '🔥 Inner Circle' :
                         'Standard'}
                    </p>
                    <p className="text-savron-silver/50 text-xs mt-1">{client.visit_count} visits</p>
                </div>
            )}

            {/* Profile Form */}
            <div className="bg-savron-grey border border-white/5 rounded-savron p-6 space-y-5">
                <p className="text-[10px] uppercase tracking-widest text-savron-silver/40">Personal Information</p>

                <div className="space-y-4">
                    <div>
                        <label className="text-savron-silver text-xs uppercase tracking-widest mb-1.5 block">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-savron"
                            placeholder="YOUR NAME"
                        />
                    </div>

                    <div>
                        <label className="text-savron-silver text-xs uppercase tracking-widest mb-1.5 block">Email</label>
                        <div className="flex items-center gap-2 bg-savron-black border border-white/[0.06] rounded-savron p-3">
                            <Mail className="w-4 h-4 text-savron-silver/30" />
                            <span className="text-savron-silver/50 text-sm">{email}</span>
                        </div>
                        <p className="text-savron-silver/30 text-[10px] mt-1">Email cannot be changed here</p>
                    </div>

                    <div>
                        <label className="text-savron-silver text-xs uppercase tracking-widest mb-1.5 block">Phone</label>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="input-savron"
                            placeholder="YOUR PHONE"
                            type="tel"
                        />
                    </div>

                    <div>
                        <label className="text-savron-silver text-xs uppercase tracking-widest mb-1.5 block">Preferences</label>
                        <textarea
                            value={preferences}
                            onChange={(e) => setPreferences(e.target.value)}
                            className="input-savron resize-none"
                            rows={3}
                            placeholder="ANY PREFERENCES FOR YOUR BARBER (E.G., STYLE NOTES, PRODUCT ALLERGIES)"
                        />
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    disabled={!client}
                    className="w-full flex gap-2 justify-center"
                >
                    {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saved ? 'Saved!' : 'Save Changes'}
                </Button>
            </div>
        </motion.div>
    );
}
