const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log("Starting DB seed...");

    // Get Barbers
    const { data: barbers, error: bErr } = await supabase.from('barbers').select('*').limit(3);
    if (bErr || !barbers || barbers.length === 0) {
        console.error("No barbers found in DB to attach bookings to. Seed script assumes barbers table is populated.");
        return;
    }
    const b1 = barbers[0];
    const b2 = barbers[1] || barbers[0];
    
    // Create random future dates based on TODAY
    const msPerDay = 24 * 60 * 60 * 1000;
    const today = new Date();
    
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Seed Clients 
    console.log("Seeding Clients...");
    const clientsData = [
        { name: 'Seed User 10W (Overdue)', email: 'seed10w@example.com', phone: '(555) 111-0000', membership_status: 'vip', last_booking_date: formatDate(new Date(today.getTime() - 75 * msPerDay)) },
        { name: 'Seed User 6W (Overdue)', email: 'seed6w@example.com', phone: '(555) 222-0000', membership_status: 'inner_circle', last_booking_date: formatDate(new Date(today.getTime() - 45 * msPerDay)) },
        { name: 'Seed User 4W', email: 'seed4w@example.com', phone: '(555) 333-0000', membership_status: 'standard', last_booking_date: formatDate(new Date(today.getTime() - 30 * msPerDay)) },
        { name: 'Active Seed Pipeline', email: 'seedactive@example.com', phone: '(555) 444-0000', membership_status: 'standard', last_booking_date: formatDate(today) }
    ];

    const { data: clients, error: cErr } = await supabase.from('clients').upsert(clientsData, { onConflict: 'email' }).select();
    if (cErr) {
        console.error("Error inserting clients:", cErr.message);
        return;
    }

    // Seed Bookings
    console.log("Seeding Bookings...");
    const bookingsData = [
        // TODAY
        { client_name: clients[3].name, client_email: clients[3].email, client_phone: clients[3].phone, service: 'The Signature Cut', barber_id: b1.id, barber_name: b1.name, date: formatDate(today), time: '11:00 AM', status: 'confirmed', p_status: 'unpaid', price: '$55' },
        { client_name: 'Walk-in Today', service: 'Haircut + Beard + Hot Towel Shave', barber_id: b2.id, barber_name: b2.name, date: formatDate(today), time: '1:00 PM', status: 'confirmed', p_status: 'paid', price: '$80' },
        
        // TOMORROW
        { client_name: clients[2].name, client_email: clients[2].email, client_phone: clients[2].phone, service: 'The Executive', barber_id: b1.id, barber_name: b1.name, date: formatDate(new Date(today.getTime() + 1 * msPerDay)), time: '10:00 AM', status: 'confirmed', p_status: 'unpaid', price: '$90' },
        
        // LATER THIS WEEK
        { client_name: clients[1].name, client_email: clients[1].email, client_phone: clients[1].phone, service: 'Haircut + Beard + Hot Towel Shave', barber_id: b2.id, barber_name: b2.name, date: formatDate(new Date(today.getTime() + 3 * msPerDay)), time: '2:30 PM', status: 'confirmed', p_status: 'unpaid', price: '$80' },
        { client_name: 'New Client Weekly', service: 'The Signature Cut', barber_id: b1.id, barber_name: b1.name, date: formatDate(new Date(today.getTime() + 5 * msPerDay)), time: '4:00 PM', status: 'confirmed', p_status: 'unpaid', price: '$55' },
        
        // PAST (to show in "done")
        { client_name: clients[0].name, client_email: clients[0].email, client_phone: clients[0].phone, service: 'The Executive', barber_id: b1.id, barber_name: b1.name, date: formatDate(new Date(today.getTime() - 10 * msPerDay)), time: '12:00 PM', status: 'completed', p_status: 'paid', price: '$90' }
    ];

    for(let b of bookingsData) {
        const { error } = await supabase.from('bookings').insert({
            client_name: b.client_name,
            client_email: b.client_email,
            client_phone: b.client_phone,
            service: b.service,
            barber_id: b.barber_id,
            barber_name: b.barber_name,
            date: b.date,
            time: b.time,
            status: b.status,
            price: b.price,
            payment_status: b.p_status
        });
        if(error) console.log("Booking specific insert err:", error.message);
    }

    console.log("Seeding complete! Dashboard should now populate.");
}

seed();
