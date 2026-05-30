export default function EPassLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-savron-black flex items-center justify-center px-4 py-12">
            {children}
        </div>
    );
}
