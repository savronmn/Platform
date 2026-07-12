import { redirect } from 'next/navigation';

export default function BarberSlugIndexPage({ params }: { params: { slug: string } }) {
    redirect(`/barber/${params.slug}/calendar`);
}
