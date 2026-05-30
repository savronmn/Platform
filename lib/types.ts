// Database types for SAVRON Business OS

export interface EmailSubscriber {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    pass_serial_number: string;
    google_pass_object_id: string | null;
    visit_count: number;
    issued_at: string;
    last_visit_at: string | null;
    active: boolean;
}

export type UserRole = 'admin' | 'barber' | 'client';

export interface UserRoleRecord {
    id: string;
    auth_id: string;
    role: UserRole;
    created_at: string;
}

export interface Barber {
    id: string;
    auth_id: string | null;
    name: string;
    slug: string;
    role: string;
    bio: string | null;
    specialties: string[] | null;
    image_url: string | null;
    phone: string | null;
    email: string | null;
    instagram_url: string | null;
    license_number: string | null;
    services_offered: string[] | null;
    google_calendar_id: string | null;
    google_calendar_tokens: Record<string, unknown> | null;
    google_sync_token: string | null;
    google_channel_id: string | null;
    google_resource_id: string | null;
    working_hours: Record<string, { open: string; close: string } | null> | null;
    portfolio_images: string[] | null;
    active: boolean;
    created_at: string;
}

export interface Service {
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
    color_code: string;
    active: boolean;
    created_at: string;
}

export interface Applicant {
    id: string;
    name: string;
    email: string;
    phone: string;
    ig_handle: string | null;
    experience: string;
    license_status: string;
    video_url: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'interview';
    notes: string | null;
    experience_summary: string | null;
    created_at: string;
}

export interface Client {
    id: string;
    auth_id: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    preferences: string | null;
    membership_status: 'standard' | 'inner_circle' | 'vip';
    visit_count: number;
    last_booking_date: string | null;
    created_at: string;
}

export interface Booking {
    id: string;
    client_id: string | null;
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    service: string;
    barber_id: string | null;
    barber_name: string | null;
    date: string;
    time: string;
    duration: string | null;
    price: string | null;
    status: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    payment_status?: string;
    notes: string | null;
    client_photo_url: string | null;
    google_event_id: string | null;
    stripe_session_id?: string;
    created_at: string;
}
