/** Historical services performed before live tracking in the app. */
export const SERVICES_PERFORMED_BASE = 7000;

export function formatServicesPerformedCount(total: number): string {
    return `${total.toLocaleString('en-US')}+`;
}

export function servicesPerformedTotal(completedBookings: number): number {
    return SERVICES_PERFORMED_BASE + completedBookings;
}
