import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Layers,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Send,
  Settings2,
  Tags,
  User,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  show?: boolean;
};

const SIDEBAR_COLLAPSED_KEY = 'cm-sidebar-collapsed';

function roleLabel(role?: string) {
  if (role === 'SUPERADMIN') return 'مدير أعلى';
  if (role === 'ADMIN') return 'مدير';
  if (role === 'ACCOUNTANT') return 'محاسب';
  if (role === 'DEPENDENT') return 'تابع';
  return 'مالك';
}

export default function Layout() {
  const { user, logout, isAdmin, isAccountant, isOwner } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [hoverTip, setHoverTip] = useState<{
    label: string;
    x: number;
    y: number;
    side: 'left' | 'right';
  } | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!collapsed) setHoverTip(null);
  }, [collapsed]);

  const items: NavItem[] = [
    { to: '/', label: 'الرئيسية', icon: Home, end: true, show: true },
    { to: '/residents', label: 'الوحدات', icon: Building2, show: isAdmin || isAccountant },
    { to: '/registrations', label: 'طلبات التسجيل', icon: ClipboardList, show: isAdmin },
    { to: '/bills', label: 'الفواتير', icon: FileText, show: true },
    { to: '/payments', label: 'مستندات الدفع', icon: CreditCard, show: isAdmin || isAccountant },
    { to: '/transactions', label: 'المعاملات المالية', icon: Receipt, show: true },
    { to: '/expenses', label: 'المصاريف', icon: Wallet, show: isAdmin || isAccountant },
    { to: '/services', label: 'الخدمات', icon: Wrench, show: true },
    { to: '/chats', label: 'المحادثات', icon: MessageCircle, show: true },
    { to: '/notifications', label: 'الإشعارات', icon: Bell, show: true },
    { to: '/send-notifications', label: 'إرسال إشعارات', icon: Send, show: isAdmin || isAccountant },
    {
      to: '/contact',
      label: isOwner || user?.role === 'DEPENDENT' ? 'تواصل معنا' : 'الطلبات والشكاوى',
      icon: MessageSquare,
      show: true,
    },
    { to: '/profile', label: 'الملف الشخصي', icon: User, show: true },
    { to: '/unit-types', label: 'أنواع الوحدات', icon: Layers, show: isAdmin || isAccountant },
    { to: '/service-types', label: 'أنواع الخدمات', icon: Settings2, show: isAdmin || isAccountant },
    { to: '/expense-types', label: 'أنواع المصاريف', icon: Tags, show: isAdmin || isAccountant },
  ];

  function renderNav(compact: boolean) {
    return (
      <nav className={cn('flex-1 space-y-1 overflow-y-auto', compact ? 'p-2' : 'p-3')}>
        {items
          .filter((item) => item.show)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={item.label}
              onMouseEnter={(e) => {
                if (!compact) return;
                const r = e.currentTarget.getBoundingClientRect();
                setHoverTip({
                  label: item.label,
                  x: r.left + r.width / 2,
                  y: r.top + r.height / 2,
                  side: r.left > window.innerWidth / 2 ? 'left' : 'right',
                });
              }}
              onMouseLeave={() => setHoverTip(null)}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-sm text-white/75 transition-colors hover:bg-[var(--sidebar-accent)] hover:text-white',
                  compact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive && 'bg-[var(--sidebar-accent)] text-white'
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              {!compact && <span>{item.label}</span>}
            </NavLink>
          ))}
      </nav>
    );
  }

  function renderFooter(compact: boolean) {
    return (
      <div className={cn('border-t border-[var(--sidebar-border)]', compact ? 'p-2' : 'p-4')}>
        {!compact && (
          <>
            <div className="mb-1 truncate text-sm font-medium">{user?.name}</div>
            <div className="mb-3 text-xs text-white/60">{roleLabel(user?.role)}</div>
            <Separator className="mb-3 bg-white/10" />
          </>
        )}
        <Button
          variant="outline"
          aria-label="تسجيل الخروج"
          onMouseEnter={(e) => {
            if (!compact) return;
            const r = e.currentTarget.getBoundingClientRect();
            setHoverTip({
              label: 'تسجيل الخروج',
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
              side: r.left > window.innerWidth / 2 ? 'left' : 'right',
            });
          }}
          onMouseLeave={() => setHoverTip(null)}
          className={cn(
            'border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white',
            compact ? 'size-10 p-0' : 'w-full'
          )}
          onClick={logout}
        >
          <LogOut className="size-4" />
          {!compact && 'تسجيل الخروج'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[4.25rem]' : 'w-64'
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-[var(--sidebar-border)]',
            collapsed ? 'justify-center px-2 py-3' : 'justify-between gap-2 px-3 py-4'
          )}
        >
          {!collapsed && (
            <h1 className="min-w-0 flex-1 text-sm font-bold leading-snug">إدارة المجمع السكني</h1>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-white hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
        {renderNav(collapsed)}
        {renderFooter(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-[min(20rem,88vw)] flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--sidebar-border)] px-4 py-4">
              <h1 className="text-base font-bold leading-snug">إدارة المجمع السكني</h1>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            {renderNav(false)}
            {renderFooter(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="فتح القائمة"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">إدارة المجمع السكني</div>
            <div className="truncate text-xs text-muted-foreground">{user?.name}</div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>

      {hoverTip && collapsed && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[100] whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg"
          style={{
            top: hoverTip.y,
            left: hoverTip.side === 'left' ? hoverTip.x - 12 : hoverTip.x + 12,
            transform:
              hoverTip.side === 'left'
                ? 'translate(-100%, -50%)'
                : 'translate(0, -50%)',
          }}
        >
          {hoverTip.label}
        </div>
      )}
    </div>
  );
}
