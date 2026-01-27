import { Navbar } from '@/components/layout/navbar';

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
