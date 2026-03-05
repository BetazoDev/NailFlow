'use client';

// ClientLayout is no longer used (SplashScreen is now in BookingWidget)
// Keeping as a minimal passthrough to avoid breaking imports
export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
