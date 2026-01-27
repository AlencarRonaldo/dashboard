import { Navbar } from '@/components/layout/navbar';

export default function ImportLayout({
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
