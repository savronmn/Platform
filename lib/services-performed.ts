/** Historical services performed before live tracking in the app. */
export const SERVICES_PERFORMED_BASE = 7000;

/** SAVRON opened May 30, 2026 — only count completed bookings from this date onward. */
export const SHOP_OPEN_DATE = '2026-05-30';

export function formatServicesPerformedCount(total: number): string {
    return `${total.toLocaleString('en-US')}+`;
}

export function servicesPerformedTotal(completedBookings: number): number {
    return SERVICES_PERFORMED_BASE + completedBookings;
}
