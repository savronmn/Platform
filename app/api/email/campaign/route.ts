// POST /api/email/campaign
// Sends bulk emails to selected clients using Resend
// Body: { clientIds: string[], template: 'miss_you' | 'special_offer' | 'custom', subject?: string, message?: string, offerText?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMissYouTemplate, getSpecialOfferTemplate, getCustomTemplate } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { clientIds, template, subject, message, offerText } = await request.json() as {
        clientIds: string[];
        template: 'miss_you' | 'special_offer' | 'custom';
        subject?: string;
        message?: string;
        offerText?: string;
    };

    if (!clientIds || clientIds.length === 0) {
        return NextResponse.json({ error: 'No clients selected' }, { status: 400 });
    }

    // Fetch clients
    const { data: clients, error } = await supabaseAdmin
        .from('clients')
        .select('id, name, email')
        .in('id', clientIds);

    if (error || !clients) {
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    const withEmail = clients.filter(c => c.email);
    if (withEmail.length === 0) {
        return NextResponse.json({ error: 'No clients have email addresses' }, { status: 400 });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send emails in batches of 10
    for (let i = 0; i < withEmail.length; i += 10) {
        const batch = withEmail.slice(i, i + 10);

        await Promise.all(batch.map(async (client) => {
            let emailData: { subject: string; html: string };

            switch (template) {
                case 'miss_you':
                    emailData = getMissYouTemplate(client.name);
                    break;
                case 'special_offer':
                    emailData = getSpecialOfferTemplate(client.name, offerText || '15% OFF your next visit');
                    break;
                case 'custom':
                    emailData = getCustomTemplate(client.name, subject || 'A message from SAVRON', message || '');
                    break;
                default:
                    emailData = getMissYouTemplate(client.name);
            }

            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: 'SAVRON Barbershop & Lounge <bookings@savronmn.com>',
                        to: [client.email],
                        subject: emailData.subject,
                        html: emailData.html,
                    }),
                });

                if (res.ok) {
                    sent++;
                } else {
                    const err = await res.text();
                    failed++;
                    errors.push(`${client.email}: ${err}`);
                }
            } catch (err) {
                failed++;
                errors.push(`${client.email}: ${String(err)}`);
            }
        }));

        // Rate limit: wait 200ms between batches
        if (i + 10 < withEmail.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return NextResponse.json({ sent, failed, total: withEmail.length, errors: errors.slice(0, 5) });
}
