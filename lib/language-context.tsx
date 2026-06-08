'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'en' | 'es';

interface LangCtx { lang: Lang; toggle: () => void; t: (key: string) => string; }

// ── Translation dictionary (admin/host UI only) ──────────────────────────────
const translations: Record<string, Record<Lang, string>> = {
    // Nav
    'nav.dashboard':      { en: 'Dashboard',      es: 'Panel' },
    'nav.host_view':      { en: 'Host View',       es: 'Vista Host' },
    'nav.requests':       { en: 'Requests',        es: 'Solicitudes' },
    'nav.barbers':        { en: 'Barbers',         es: 'Barberos' },
    'nav.clients':        { en: 'Clients',         es: 'Clientes' },
    'nav.membership':     { en: 'Membership',      es: 'Membresía' },
    'nav.communications': { en: 'Communications',  es: 'Comunicaciones' },
    'nav.services':       { en: 'Services',        es: 'Servicios' },
    'nav.hiring':         { en: 'Hiring',          es: 'Contratación' },
    'nav.sign_out':       { en: 'Sign Out',        es: 'Cerrar Sesión' },
    'nav.business_os':    { en: 'Business OS',     es: 'Sistema Empresarial' },

    // Host view
    'host.title':         { en: 'Host View',       es: 'Vista Host' },
    'host.live':          { en: 'Live',            es: 'En Vivo' },
    'host.connecting':    { en: 'Connecting…',     es: 'Conectando…' },
    'host.confirmed':     { en: 'Confirmed',       es: 'Confirmados' },
    'host.done':          { en: 'Done',            es: 'Completados' },
    'host.no_show':       { en: 'No-show',         es: 'No Se Presentó' },
    'host.walk_in':       { en: 'Walk-in',         es: 'Sin Cita' },
    'host.today':         { en: 'Today',           es: 'Hoy' },
    'host.today_progress':{ en: "Today's Progress",es: 'Progreso del Día' },
    'host.waiting':       { en: 'waiting',         es: 'esperando' },
    'host.no_show_s':     { en: 'no-show',         es: 'no se presentó' },
    'host.cancelled_s':   { en: 'cancelled',       es: 'cancelado' },
    'host.filter':        { en: 'Filter:',         es: 'Filtrar:' },
    'host.all':           { en: 'All',             es: 'Todos' },
    'host.check_in':      { en: 'Check In',        es: 'Registrar' },
    'host.no_show_btn':   { en: 'No Show',         es: 'No Se Presentó' },
    'host.cancel_appt':   { en: 'Cancel Appointment', es: 'Cancelar Cita' },
    'host.checked_in':    { en: 'Checked In',      es: 'Registrado' },
    'host.undo':          { en: 'Undo',            es: 'Deshacer' },
    'host.restore':       { en: 'Restore',         es: 'Restaurar' },
    'host.cancelled_b':   { en: 'Cancelled',       es: 'Cancelado' },
    'host.edit':          { en: 'Edit',            es: 'Editar' },
    'host.delete':        { en: 'Delete',          es: 'Eliminar' },
    'host.confirm':       { en: 'Confirm',         es: 'Confirmar' },
    'host.track_visit':   { en: 'Track This Visit',es: 'Registrar Esta Visita' },
    'host.open_gcal':     { en: 'Edit / Delete in Google Calendar', es: 'Editar / Eliminar en Google Calendar' },
    'host.gcal_hint':     { en: "Make sure you're signed into the right account", es: 'Asegúrate de estar en la cuenta correcta' },
    'host.appointment':   { en: 'Appointment',     es: 'Cita' },
    'host.service':       { en: 'Service',         es: 'Servicio' },
    'host.date_time':     { en: 'Date & Time',     es: 'Fecha y Hora' },
    'host.client_photo':  { en: 'Client Photo',    es: 'Foto del Cliente' },

    // Common admin
    'admin.search':       { en: 'Search',          es: 'Buscar' },
    'admin.save':         { en: 'Save',            es: 'Guardar' },
    'admin.cancel':       { en: 'Cancel',          es: 'Cancelar' },
    'admin.delete':       { en: 'Delete',          es: 'Eliminar' },
    'admin.add':          { en: 'Add',             es: 'Agregar' },
    'admin.edit':         { en: 'Edit',            es: 'Editar' },
    'admin.loading':      { en: 'Loading…',        es: 'Cargando…' },
    'admin.name':         { en: 'Name',            es: 'Nombre' },
    'admin.email':        { en: 'Email',           es: 'Correo' },
    'admin.phone':        { en: 'Phone',           es: 'Teléfono' },
    'admin.status':       { en: 'Status',          es: 'Estado' },
    'admin.date':         { en: 'Date',            es: 'Fecha' },
    'admin.notes':        { en: 'Notes',           es: 'Notas' },
};

const LanguageContext = createContext<LangCtx>({
    lang: 'en',
    toggle: () => {},
    t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<Lang>('en');

    useEffect(() => {
        const saved = localStorage.getItem('savron_admin_lang') as Lang | null;
        if (saved === 'en' || saved === 'es') setLang(saved);
    }, []);

    const toggle = () => {
        setLang(prev => {
            const next = prev === 'en' ? 'es' : 'en';
            localStorage.setItem('savron_admin_lang', next);
            return next;
        });
    };

    const t = (key: string): string => translations[key]?.[lang] ?? key;

    return (
        <LanguageContext.Provider value={{ lang, toggle, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
