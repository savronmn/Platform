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
    { id: 1, name: "Kids Cut",                          duration: "30 min", durationMin: 30, price: "$50", priceCents: 5000, color: "teal",    description: "Classic precision cut for the next generation." },
    { id: 2, name: "Signature Cut",                     duration: "45 min", durationMin: 45, price: "$50", priceCents: 5000, color: "emerald", description: "Tailored fade or scissor cut, finished with a clean neckline." },
    { id: 3, name: "Long Styles Haircut",               duration: "60 min", durationMin: 60, price: "$60", priceCents: 6000, color: "indigo",  description: "Sculpted cut for longer hair — texture, shape, and movement." },
    { id: 4, name: "Beard Sculpting + Hot Towel Shave", duration: "45 min", durationMin: 45, price: "$50", priceCents: 5000, color: "amber",   description: "Straight-razor line up, hot towel ritual, conditioning finish." },
    { id: 5, name: "The Executive",                     duration: "75 min", durationMin: 75, price: "$90", priceCents: 9000, color: "blue",    description: "The full SAVRON experience — signature cut paired with hot towel shave." },
];

// Color map for host dashboard booking blocks
export const SERVICE_COLORS: Record<string, string> = {
    'Kids Cut':                          'bg-teal-500/20 border-teal-500/40 text-teal-300',
    'Signature Cut':                     'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    'Long Styles Haircut':               'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
    'Beard Sculpting + Hot Towel Shave': 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    'The Executive':                     'bg-blue-500/20 border-blue-500/40 text-blue-300',
    // Legacy aliases — keep until DB is wiped
    'The Signature Cut': 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    'Beard Sculpting':   'bg-amber-500/20 border-amber-500/40 text-amber-300',
    'Hot Towel Shave':   'bg-purple-500/20 border-purple-500/40 text-purple-300',
};

// Color key → Tailwind class (used with dynamic services from DB)
export const COLOR_CLASS_MAP: Record<string, string> = {
    emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
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
    emerald: 'bg-emerald-400', blue:   'bg-blue-400',   amber:  'bg-amber-400',
    purple:  'bg-purple-400',  teal:   'bg-teal-400',   rose:   'bg-rose-400',
    orange:  'bg-orange-400',  cyan:   'bg-cyan-400',   indigo: 'bg-indigo-400',
    yellow:  'bg-yellow-400',
};

export const AVAILABLE_COLORS = Object.keys(COLOR_CLASS_MAP) as string[];

// Shop time slots
export const TIME_SLOTS = [
    "10:00 AM", "10:45 AM", "11:30 AM",
    "1:00 PM",  "1:45 PM",  "2:30 PM",  "3:15 PM", "4:00 PM",
];
