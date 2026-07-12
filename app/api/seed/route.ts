import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Seed Services if empty
        const { data: existingServices } = await supabase.from('services').select('id');
        if (!existingServices || existingServices.length === 0) {
            const { error: sErr } = await supabase.from('services').insert([
                { name: 'The Executive', duration_minutes: 75, price_cents: 9000, color: 'blue', description: 'The full SAVRON experience — signature cut paired with hot towel shave.', active: true },
                { name: 'Signature Cut', duration_minutes: 45, price_cents: 5000, color: 'blue', description: 'Tailored fade or scissor cut, finished with a clean neckline.', active: true },
                { name: 'Long Styles Haircut', duration_minutes: 60, price_cents: 6000, color: 'indigo', description: 'Sculpted cut for longer hair — texture, shape, and movement.', active: true },
                { name: 'Kids Cut', duration_minutes: 30, price_cents: 5000, color: 'teal', description: 'Classic precision cut for the next generation.', active: true },
                { name: 'Beard Sculpting + Hot Towel Shave', duration_minutes: 45, price_cents: 5000, color: 'amber', description: 'Straight-razor line up, hot towel ritual, conditioning finish.', active: true }
            ]);
            if (sErr) throw new Error(`Services seed failed: ${sErr.message}`);
        }

        // 2. Seed Barbers if empty
        const { data: existingBarbers } = await supabase.from('barbers').select('*');
        let barbers = existingBarbers || [];
        if (barbers.length === 0) {
            const { data: newBarbers, error: bErr } = await supabase.from('barbers').insert([
                { name: 'Albert Savron', slug: 'albert-savron', role: 'Master Barber', bio: 'Founder and master groomer with 15+ years experience.', specialties: ['Classic Cuts', 'Beard Sculpting', 'Hot Shaves'], active: true, email: 'albert@savronmn.com' },
                { name: 'Michael C.', slug: 'michael-c', role: 'Senior Barber', bio: 'Specialist in modern skin fades and creative texturing.', specialties: ['Skin Fades', 'Textured Crops'], active: true, email: 'michael@savronmn.com' },
                { name: 'Giovanni R.', slug: 'giovanni-r', role: 'Barber', bio: 'Classic styling and straight-razor detailing specialist.', specialties: ['Taper Fades', 'Razor Lineups'], active: true, email: 'giovanni@savronmn.com' }
            ]).select();
            if (bErr) throw new Error(`Barbers seed failed: ${bErr.message}`);
            barbers = newBarbers || [];
        }

        const b1 = barbers[0];
        const b2 = barbers[1] || barbers[0];

        // 3. Seed Clients
        const msPerDay = 24 * 60 * 60 * 1000;
        const today = new Date();
        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        const clientsData = [
            { name: 'Marcus Aurelius', email: 'marcus@philosophy.edu', phone: '(612) 555-0199', membership_status: 'vip', last_booking_date: formatDate(new Date(today.getTime() - 75 * msPerDay)) },
            { name: 'Lucius Verus', email: 'lucius@co-emperor.gov', phone: '(612) 555-0188', membership_status: 'inner_circle', last_booking_date: formatDate(new Date(today.getTime() - 45 * msPerDay)) },
            { name: 'Seneca the Younger', email: 'seneca@stoic.org', phone: '(612) 555-0177', membership_status: 'standard', last_booking_date: formatDate(new Date(today.getTime() - 30 * msPerDay)) },
            { name: 'Epictetus', email: 'epictetus@freedom.net', phone: '(612) 555-0166', membership_status: 'standard', last_booking_date: formatDate(today) }
        ];

        const { data: clients, error: cErr } = await supabase.from('clients').upsert(clientsData, { onConflict: 'email' }).select();
        if (cErr) throw new Error(`Clients seed failed: ${cErr.message}`);

        // 4. Seed Bookings
        const bookingsData = [
            // TODAY
            { client_name: clients[3].name, client_email: clients[3].email, client_phone: clients[3].phone, service: 'Signature Cut', barber_id: b1.id, barber_name: b1.name, date: formatDate(today), time: '11:00 AM', status: 'confirmed', price: '$50' },
            { client_name: 'Walk-in Guest', service: 'Beard Sculpting + Hot Towel Shave', barber_id: b2.id, barber_name: b2.name, date: formatDate(today), time: '1:00 PM', status: 'confirmed', price: '$50' },
            
            // TOMORROW
            { client_name: clients[2].name, client_email: clients[2].email, client_phone: clients[2].phone, service: 'The Executive', barber_id: b1.id, barber_name: b1.name, date: formatDate(new Date(today.getTime() + 1 * msPerDay)), time: '10:00 AM', status: 'confirmed', price: '$90' },
            
            // LATER THIS WEEK
            { client_name: clients[1].name, client_email: clients[1].email, client_phone: clients[1].phone, service: 'Beard Sculpting + Hot Towel Shave', barber_id: b2.id, barber_name: b2.name, date: formatDate(new Date(today.getTime() + 3 * msPerDay)), time: '02:30 PM', status: 'confirmed', price: '$50' },
            { client_name: 'Sophia Loren', service: 'Signature Cut', barber_id: b1.id, barber_name: b1.name, date: formatDate(new Date(today.getTime() + 5 * msPerDay)), time: '04:00 PM', status: 'confirmed', price: '$50' },
            
            // PAST
            { client_name: clients[0].name, client_email: clients[0].email, client_phone: clients[0].phone, service: 'The Executive', barber_id: b1.id, barber_name: b1.name, date: formatDate(new Date(today.getTime() - 10 * msPerDay)), time: '12:00 PM', status: 'completed', price: '$90' }
        ];

        // Insert mock bookings
        for (const b of bookingsData) {
            const { error: insErr } = await supabase.from('bookings').insert({
                client_name: b.client_name,
                client_email: b.client_email,
                client_phone: b.client_phone,
                service: b.service,
                barber_id: b.barber_id,
                barber_name: b.barber_name,
                date: b.date,
                time: b.time,
                status: b.status,
                price: b.price
            });
            if (insErr) console.warn("Could not insert mock booking:", insErr.message);
        }

        return NextResponse.json({ success: true, message: 'Database seeded successfully' });
    } catch (e: any) {
        console.error("Seed route failed:", e);
        return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
