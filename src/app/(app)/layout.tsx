import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </ToastProvider>
  );
}
