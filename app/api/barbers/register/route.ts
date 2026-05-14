import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function buildSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

async function uniqueSlug(supabase: ReturnType<typeof getSupabaseAdmin>, base: string): Promise<string> {
    let candidate = base;
    let n = 2;
    while (true) {
        const { data } = await supabase.from('barbers').select('id').eq('slug', candidate).maybeSingle();
        if (!data) return candidate;
        candidate = `${base}-${n++}`;
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const formData = await req.formData();

        const name          = (formData.get('name')          as string | null)?.trim();
        const email         = (formData.get('email')         as string | null)?.trim();
        const password      = (formData.get('password')      as string | null)?.trim();
        const phone         = (formData.get('phone')         as string | null)?.trim() || null;
        const bio           = (formData.get('bio')           as string | null)?.trim() || null;
        const instagram_url = (formData.get('instagram_url') as string | null)?.trim() || null;
        const specialties   = (formData.get('specialties')   as string | null)?.trim() || null;
        const image         = formData.get('image') as File | null;
        const portfolioFiles = formData.getAll('portfolio') as File[];

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
        }

        // 1. Create the auth user first
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name }
        });

        if (authError) {
            console.error('Auth create error:', authError);
            return NextResponse.json({ error: 'Email may already be in use or password too weak.' }, { status: 400 });
        }

        const auth_id = authData.user.id;

        const slug = await uniqueSlug(supabase, buildSlug(name));

        let image_url: string | null = null;
        if (image && image.size > 0) {
            const buffer = Buffer.from(await image.arrayBuffer());
            const ext    = image.name.split('.').pop() || 'jpg';
            const fileName = `${auth_id}/profile/main_${Date.now()}.${ext}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('barber-portfolios')
                .upload(fileName, buffer, { contentType: image.type, upsert: false });

            if (!uploadError && uploadData) {
                const { data: { publicUrl } } = supabase.storage.from('barber-portfolios').getPublicUrl(fileName);
                image_url = publicUrl;
            } else {
                console.warn('Profile image upload failed:', uploadError?.message);
            }
        }

        // 3. Upload portfolio images
        const portfolio_images: string[] = [];
        for (const file of portfolioFiles) {
            if (file.size > 0) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const ext = file.name.split('.').pop() || 'jpg';
                const fileName = `${auth_id}/portfolio/port_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('barber-portfolios')
                    .upload(fileName, buffer, { contentType: file.type, upsert: false });

                if (!uploadError && uploadData) {
                    const { data: { publicUrl } } = supabase.storage.from('barber-portfolios').getPublicUrl(fileName);
                    portfolio_images.push(publicUrl);
                }
            }
        }

        const specialtiesArray = specialties
            ? specialties.split(',').map(s => s.trim()).filter(Boolean)
            : null;

        const { data: newBarber, error: insertError } = await supabase
            .from('barbers')
            .insert({
                auth_id,
                name,
                slug,
                email,
                phone,
                bio,
                instagram_url,
                image_url,
                portfolio_images,
                specialties: specialtiesArray,
                active: false,   // admin must approve before barber goes live
                role: 'Barber',
            })
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            // Cleanup auth user if barber insert fails
            await supabase.auth.admin.deleteUser(auth_id);
            return NextResponse.json({ error: 'Failed to save profile', detail: insertError.message }, { status: 500 });
        }

        // 5. Assign barber role
        const { error: roleError } = await supabase.from('user_roles').insert({
            auth_id,
            role: 'barber'
        });

        if (roleError) {
            console.error('Role insert error:', roleError);
            return NextResponse.json({ error: 'Failed to assign role', detail: roleError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, barber: newBarber });

    } catch (err) {
        console.error('Registration API error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
