import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/staff-auth';

export async function POST(req: NextRequest) {
    try {
        const staff = await requireStaff();
        if (!staff.ok) {
            return NextResponse.json({ error: staff.error }, { status: staff.status });
        }

        const { subject, htmlContent, recipients } = await req.json();

        if (!subject || !htmlContent || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const brevoApiKey = process.env.BREVO_API_KEY;
        
        if (!brevoApiKey) {
            return NextResponse.json({ error: 'Brevo API key not configured' }, { status: 500 });
        }
        
        // Format recipients for Brevo API
        const to = recipients.map((r: { email: string, name?: string }) => ({
            email: r.email,
            name: r.name || undefined
        }));

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': brevoApiKey,
                'accept': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'info@savronmn.com', name: 'SAVRON Barbershop' },
                to,
                subject,
                htmlContent,
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Brevo API Error:', data);
            return NextResponse.json({ error: 'Failed to send campaign', details: data }, { status: response.status });
        }

        return NextResponse.json({ success: true, messageId: data.messageId });
    } catch (err) {
        console.error('Brevo Endpoint Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
