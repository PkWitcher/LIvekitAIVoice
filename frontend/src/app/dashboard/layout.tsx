import AutoLogoutModal from "@/components/AutoLogoutModal";

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AutoLogoutModal />
      {children}
    </>
  );
}
