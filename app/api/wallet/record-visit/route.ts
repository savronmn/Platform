import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncWalletsAfterCheckin } from '@/lib/wallet-checkin';
import { requireStaff } from '@/lib/staff-auth';
import { sendMembershipPassEmail } from '@/lib/send-membership-pass';
import {
    isGoogleWalletConfigured,
    updateGoogleWalletPass,
} from '@/lib/google-wallet';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function POST(req: NextRequest) {
    try {
        const staff = await requireStaff();
        if (!staff.ok) {
            return NextResponse.json({ error: staff.error }, { status: staff.status });
        }

        const supabase = getSupabaseAdmin();
        const body = await req.json();
        const { subscriber_id, action } = body;

        if (!subscriber_id || !action) {
            return NextResponse.json({ error: 'subscriber_id and action required' }, { status: 400 });
        }

        const { data: subscriber, error: fetchError } = await supabase
            .from('email_subscribers')
            .select('*')
            .eq('id', subscriber_id)
            .single();

        if (fetchError || !subscriber) {
            return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
        }

        if (action === 'record_visit') {
            const { data: updated, error: updateError } = await supabase
                .rpc('increment_subscriber_visit', {
                    p_subscriber_id: subscriber_id,
                    p_force: true,
                });

            let newCount: number;
            let lastVisitAt: string;

            if (updateError || !updated) {
                newCount = (subscriber.visit_count ?? 0) + 1;
                lastVisitAt = new Date().toISOString();
                const { error: fallbackErr } = await supabase
                    .from('email_subscribers')
                    .update({ visit_count: newCount, last_visit_at: lastVisitAt })
                    .eq('id', subscriber_id)
                    .eq('visit_count', subscriber.visit_count);
                if (fallbackErr) {
                    return NextResponse.json({ error: 'Failed to update visit count' }, { status: 500 });
                }
            } else {
                const row = Array.isArray(updated) ? updated[0] : updated;
                newCount = row.visit_count;
                lastVisitAt = row.last_visit_at;
            }

            const walletSync = await syncWalletsAfterCheckin(subscriber, newCount, lastVisitAt);

            return NextResponse.json({
                success: true,
                visit_count: newCount,
                ...walletSync,
                google_wallet_object_id: subscriber.google_pass_object_id ?? null,
            });
        }

        if (action === 'remove_visit') {
            const { data: updated, error: updateError } = await supabase
                .rpc('decrement_subscriber_visit', { p_subscriber_id: subscriber_id });

            let newCount: number;
            let lastVisitAt: string;

            if (updateError || !updated) {
                newCount = Math.max(0, (subscriber.visit_count ?? 0) - 1);
                const { error: fallbackErr } = await supabase
                    .from('email_subscribers')
                    .update({ visit_count: newCount })
                    .eq('id', subscriber_id)
                    .eq('visit_count', subscriber.visit_count);
                if (fallbackErr) {
                    return NextResponse.json({ error: 'Failed to update visit count' }, { status: 500 });
                }
                lastVisitAt = subscriber.last_visit_at ?? new Date().toISOString();
            } else {
                const row = Array.isArray(updated) ? updated[0] : updated;
                newCount = row.visit_count;
                lastVisitAt = row.last_visit_at ?? subscriber.last_visit_at ?? new Date().toISOString();
            }

            const walletSync = await syncWalletsAfterCheckin(subscriber, newCount, lastVisitAt);

            return NextResponse.json({
                success: true,
                visit_count: newCount,
                ...walletSync,
                google_wallet_object_id: subscriber.google_pass_object_id ?? null,
            });
        }

        if (action === 'send_updated_pass') {
            try {
                await sendMembershipPassEmail(subscriber);
            } catch (err) {
                console.error('Pass resend failed:', err);
                return NextResponse.json({ error: 'Failed to resend pass' }, { status: 500 });
            }

            const walletSync = await syncWalletsAfterCheckin(
                subscriber,
                subscriber.visit_count ?? 0,
                subscriber.last_visit_at ?? new Date().toISOString(),
            );

            return NextResponse.json({
                success: true,
                message: 'Updated pass sent to ' + subscriber.email,
                ...walletSync,
            });
        }

        if (action === 'update_profile') {
            const { name, email, phone } = body as {
                name?: string;
                email?: string;
                phone?: string | null;
            };

            const updates: { name?: string; email?: string; phone?: string | null } = {};
            if (typeof name === 'string' && name.trim()) updates.name = name.trim();
            if (typeof email === 'string' && email.trim()) updates.email = email.trim();
            if (phone !== undefined) updates.phone = phone?.trim() || null;

            if (Object.keys(updates).length === 0) {
                return NextResponse.json({ error: 'No profile fields to update' }, { status: 400 });
            }

            const { data: updated, error: updateError } = await supabase
                .from('email_subscribers')
                .update(updates)
                .eq('id', subscriber_id)
                .select('*')
                .single();

            if (updateError || !updated) {
                if (updateError?.code === '23505') {
                    return NextResponse.json({ error: 'That email is already on the membership list.' }, { status: 409 });
                }
                return NextResponse.json({ error: updateError?.message ?? 'Failed to update member' }, { status: 500 });
            }

            let googleWalletUpdated = false;
            if (isGoogleWalletConfigured() && updated.google_pass_object_id) {
                googleWalletUpdated = await updateGoogleWalletPass(
                    updated.google_pass_object_id,
                    updated.name,
                    updated.email,
                    updated.visit_count ?? 0,
                );
            }

            const passUpdatedAt = new Date().toISOString();
            await supabase
                .from('email_subscribers')
                .update({ pass_updated_at: passUpdatedAt })
                .eq('id', subscriber_id);

            return NextResponse.json({
                success: true,
                subscriber: updated,
                google_wallet_updated: googleWalletUpdated,
                pass_updated_at: passUpdatedAt,
            });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('record-visit route failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
