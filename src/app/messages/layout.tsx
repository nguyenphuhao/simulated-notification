import AdminLayout from '@/components/admin/admin-layout';

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}

