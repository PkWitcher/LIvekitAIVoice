export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-shell">
      <div className="dash-ambient">
        <div className="dash-orb dash-orb-1" />
        <div className="dash-orb dash-orb-2" />
      </div>
      {children}
    </div>
  );
}
