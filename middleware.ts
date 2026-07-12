import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const rawKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const url = rawUrl && rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co';
    const key = rawKey && rawKey.length > 10 ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    const { data: { user } } = await supabase.auth.getUser();
    const pathname = request.nextUrl.pathname;

    // =============================================
    // ADMIN routes — redirect to /admin/login
    // =============================================
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        if (!user) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }

    if (pathname === '/admin/login' && user) {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    // =============================================
    // BARBER routes — redirect to login when needed
    // =============================================
    const slugPortalMatch = pathname.match(/^\/barber\/([^/]+)(?:\/|$)/);
    const slugFromPath = slugPortalMatch?.[1];
    const reservedBarberSegments = new Set(['login', 'register', 'calendar', 'profile', 'share', 'requests']);
    const isSlugPortal = !!slugFromPath && !reservedBarberSegments.has(slugFromPath);

    if (isSlugPortal) {
        if (pathname.endsWith('/login')) {
            if (user) {
                return NextResponse.redirect(new URL(`/barber/${slugFromPath}/calendar`, request.url));
            }
        } else if (!user) {
            return NextResponse.redirect(new URL(`/barber/${slugFromPath}/login`, request.url));
        }
    } else if (
        pathname.startsWith('/barber') &&
        !pathname.startsWith('/barber/login') &&
        !pathname.startsWith('/barber/register')
    ) {
        if (!user) {
            return NextResponse.redirect(new URL('/barber/login', request.url));
        }
    }

    if (pathname === '/barber/login' && user) {
        return NextResponse.redirect(new URL('/barber', request.url));
    }

    // =============================================
    // HOST routes — redirect to /admin/login
    // =============================================
    if (pathname.startsWith('/host')) {
        if (!user) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }

    // =============================================
    // MEMBERSHIP routes — redirect to /membership/login
    // =============================================
    if (pathname.startsWith('/membership') && !pathname.startsWith('/membership/login')) {
        if (!user) {
            return NextResponse.redirect(new URL('/membership/login', request.url));
        }
    }

    if (pathname === '/membership/login' && user) {
        return NextResponse.redirect(new URL('/membership', request.url));
    }

    return supabaseResponse;
}

export const config = {
    matcher: ['/admin/:path*', '/barber/:path*', '/membership/:path*', '/host/:path*', '/host'],
};
