import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, EmptyState } from '@/components/ui-helpers';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { isAdmin, isAccountant } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  function load() {
    api.getNotifications().then(setNotifications).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: number) {
    await api.markNotificationRead(id);
    load();
  }

  async function markAllRead() {
    await api.markAllRead();
    load();
  }

  async function runReminders() {
    await api.runReminders();
    load();
    alert('تم إرسال التذكيرات');
  }

  return (
    <div>
      <PageHeader title="الإشعارات">
        <Button variant="outline" onClick={markAllRead}>
          تعيين الكل كمقروء
        </Button>
        {(isAdmin || isAccountant) && (
          <Button onClick={runReminders}>إرسال تذكيرات السداد</Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <EmptyState>لا توجد إشعارات</EmptyState>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start justify-between gap-4 px-6 py-4',
                    !n.read && 'cursor-pointer bg-sky-50'
                  )}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <div>
                    <strong>{n.title}</strong>
                    <p className="mt-1 text-muted-foreground">{n.message}</p>
                  </div>
                  <div className="shrink-0 text-sm text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString('ar-EG')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
