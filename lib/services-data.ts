// Shared service definitions — mirrors the `services` DB table
// These hardcoded values are used as fallback / until the DB is seeded
export type ServiceItem = {
    id: number;
    name: string;
    duration: string;
    durationMin: number;
    price: string;
    priceCents: number;
    color: string;
    description?: string;
};

export const SERVICES: ServiceItem[] = [
    { id: 1, name: "The Executive",                     duration: "75 min", durationMin: 75, price: "$90", priceCents: 9000, color: "blue",    description: "The full SAVRON experience: signature cut paired with hot towel shave." },
    { id: 2, name: "Signature Cut",                     duration: "45 min", durationMin: 45, price: "$50", priceCents: 5000, color: "blue", description: "Tailored fade or scissor cut, finished with a clean neckline." },
    { id: 3, name: "Long Styles Haircut",               duration: "60 min", durationMin: 60, price: "$60", priceCents: 6000, color: "indigo",  description: "Sculpted cut for longer hair with texture, shape, and movement." },
    { id: 4, name: "Kids Cut",                          duration: "30 min", durationMin: 30, price: "$50", priceCents: 5000, color: "teal",    description: "Classic precision cut for the next generation." },
    { id: 5, name: "Haircut + Beard + Hot Towel Shave", duration: "60 min", durationMin: 60, price: "$80", priceCents: 8000, color: "amber",   description: "Straight-razor line up, hot towel ritual, conditioning finish." },
];

/** Optional add-on. not listed as a primary service; price only, no extra time */
export const EYEBROWS_ADDON = {
    name: 'Eyebrows',
    priceCents: 1000,
    price: '$10',
} as const;

// Color map for host dashboard booking blocks
export const SERVICE_COLORS: Record<string, string> = {
    'Kids Cut':                          'bg-teal-500/20 border-teal-500/40 text-teal-300',
    'Signature Cut':                     'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'Long Styles Haircut':               'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
    'Haircut + Beard + Hot Towel Shave': 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    'The Executive':                     'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'Eyebrows':                          'bg-rose-500/20 border-rose-500/40 text-rose-300',
    // Legacy aliases. keep for historical bookings
    'The Signature Cut': 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'Beard Sculpting + Hot Towel Shave': 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    'Beard Sculpting':   'bg-amber-500/20 border-amber-500/40 text-amber-300',
    'Hot Towel Shave':   'bg-purple-500/20 border-purple-500/40 text-purple-300',
};

// Color key → Tailwind class (used with dynamic services from DB)
export const COLOR_CLASS_MAP: Record<string, string> = {
    emerald: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    blue:    'bg-blue-500/20 border-blue-500/40 text-blue-300',
    amber:   'bg-amber-500/20 border-amber-500/40 text-amber-300',
    purple:  'bg-purple-500/20 border-purple-500/40 text-purple-300',
    teal:    'bg-teal-500/20 border-teal-500/40 text-teal-300',
    rose:    'bg-rose-500/20 border-rose-500/40 text-rose-300',
    orange:  'bg-orange-500/20 border-orange-500/40 text-orange-300',
    cyan:    'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
    indigo:  'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
    yellow:  'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
};

// Color key → dot color (for admin UI)
export const COLOR_DOTS: Record<string, string> = {
    emerald: 'bg-savron-blue-light', blue:   'bg-blue-400',   amber:  'bg-amber-400',
    purple:  'bg-purple-400',  teal:   'bg-teal-400',   rose:   'bg-rose-400',
    orange:  'bg-orange-400',  cyan:   'bg-cyan-400',   indigo: 'bg-indigo-400',
    yellow:  'bg-yellow-400',
};

export const AVAILABLE_COLORS = Object.keys(COLOR_CLASS_MAP) as string[];

// ── Hex color system ──────────────────────────────────────────────────────────

export const COLOR_HEX_MAP: Record<string, string> = {
    emerald: '#60a5fa', blue:   '#60a5fa', amber:  '#fbbf24',
    purple:  '#c084fc', teal:   '#2dd4bf', rose:   '#fb7185',
    orange:  '#fb923c', cyan:   '#22d3ee', indigo: '#818cf8',
    yellow:  '#facc15',
};

export const PRESET_HEX_COLORS: string[] = Object.values(COLOR_HEX_MAP);

export function resolveColor(colorStr: string | null | undefined): string {
    if (!colorStr) return '#60a5fa';
    if (colorStr.startsWith('#')) return colorStr;
    return COLOR_HEX_MAP[colorStr] ?? '#34d399';
}

export function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '').padEnd(6, '0');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

export function serviceBlockStyle(colorStr: string | null | undefined): Record<string, string> {
    const hex = resolveColor(colorStr);
    return {
        backgroundColor: hexToRgba(hex, 0.12),
        borderColor: hexToRgba(hex, 0.38),
        color: hex,
    };
}

// Shop hours (Google Business listing)
export type ShopDayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type DaySchedule = { open: string; close: string };

/** Canonical SAVRON shop hours. Mon–Fri 10–7, Sat 9–4:30, Sun 9–2 */
export const SHOP_WORKING_HOURS: Record<ShopDayKey, DaySchedule | null> = {
    Mon: { open: '10:00', close: '19:00' },
    Tue: { open: '10:00', close: '19:00' },
    Wed: { open: '10:00', close: '19:00' },
    Thu: { open: '10:00', close: '19:00' },
    Fri: { open: '10:00', close: '19:00' },
    Sat: { open: '09:00', close: '16:30' },
    Sun: { open: '09:00', close: '14:00' },
};

/** Calendar grid spans earliest open → latest close across the week (9 AM – 7 PM). */
export const SHOP_GRID_OPEN = '09:00';
export const SHOP_GRID_CLOSE = '19:00';

function format24to12Short(t: string): string {
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatScheduleRange(schedule: DaySchedule): string {
    return `${format24to12Short(schedule.open)} – ${format24to12Short(schedule.close)}`;
}

export function getShopDayKey(date: Date): ShopDayKey {
    const keys: ShopDayKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return keys[date.getDay()];
}

export function getShopScheduleForDate(date: Date): DaySchedule | null {
    return SHOP_WORKING_HOURS[getShopDayKey(date)];
}

// Shop time slots. weekday fallback when a barber has no working_hours set
export const TIME_SLOTS = generateTimeSlots('10:00', '19:00', 45);

// Host calendar grid: 9 AM – 7 PM (covers full weekly schedule without dead space)
export const HOST_TIME_SLOTS = generateTimeSlots(SHOP_GRID_OPEN, SHOP_GRID_CLOSE, 45);

// Generate 12h-format time slots from 24h open/close strings (e.g. "10:00", "19:00")
export function generateTimeSlots(open: string, close: string, intervalMin = 45): string[] {
    const [oh, om] = open.split(':').map(Number);
    const [ch, cm] = close.split(':').map(Number);
    const startMin = oh * 60 + om;
    const endMin = ch * 60 + cm;
    const slots: string[] = [];
    for (let min = startMin; min < endMin; min += intervalMin) {
        const h24 = Math.floor(min / 60);
        const m = min % 60;
        const period = h24 < 12 ? 'AM' : 'PM';
        const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
        slots.push(`${h12}:${String(m).padStart(2, '0')} ${period}`);
    }
    return slots;
}
