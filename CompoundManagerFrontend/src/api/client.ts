import type { User, Resident, Bill, Transaction, Service, Notification, DashboardStats, PaymentProof, ServiceType, UnitType, ExpenseType, Expense, ContactRequest, Dependent, ChatGroupSummary, ChatGroupDetail, ChatMessage, ChatMember, ChatJoinRequest } from '../types';
import { API_BASE } from '../constants/api';

/** Origin that serves `/uploads/...` (API host). */
export const UPLOADS_BASE = API_BASE.replace(/\/api\/?$/, '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function resolveUploadUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('blob:')) return path;
  // Private Vercel Blob — serve via authenticated API proxy (works for img/video/audio).
  if (path.includes('.private.blob.vercel-storage.com')) {
    const token = getToken();
    const qs = new URLSearchParams({ url: path });
    if (token) qs.set('access_token', token);
    return `${API_BASE}/media?${qs.toString()}`;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${UPLOADS_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register') && !window.location.pathname.startsWith('/forgot-password') && !window.location.pathname.startsWith('/reset-password')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(typeof err.error === 'string' ? err.error : 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getSuggestedUsername: () => request<{ username: string }>('/auth/suggested-username'),

  register: (data: Record<string, unknown>) =>
    request<{ message: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string; resetToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (email: string, token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, token, newPassword }),
    }),

  changePassword: (currentPassword: string | undefined, newPassword: string) =>
    request<{ message: string; mustChangePassword?: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        ...(currentPassword !== undefined && { currentPassword }),
        newPassword,
      }),
    }),

  changeUsername: (username: string) =>
    request<{ message: string; username: string; mustChangeUsername?: boolean }>('/auth/change-username', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  updateProfile: (data: Record<string, unknown>) =>
    request<User & { resident?: Resident }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getMe: () => request<User & { resident?: Resident }>('/auth/me'),

  getDashboard: (year?: number) =>
    request<DashboardStats>(`/dashboard/stats${year ? `?year=${year}` : ''}`),

  getResidents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Resident[]>(`/residents${qs}`);
  },

  getNextUsername: () => request<{ username: string }>('/residents/next-username'),

  getMyResident: () => request<Resident>('/residents/me'),

  updateMyProfile: (data: {
    residentName?: string;
    nationality?: string;
    mobile?: string;
    landLine?: string | null;
    email?: string;
    password?: string;
    currentPassword?: string;
  }) =>
    request<{ resident: Resident; user: User }>('/residents/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  createResident: (data: Partial<Resident> & { password?: string }) =>
    request<Resident>('/residents', { method: 'POST', body: JSON.stringify(data) }),

  updateResident: (id: number, data: Partial<Resident>) =>
    request<Resident>(`/residents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  resetResidentPassword: (id: number) =>
    request<{ message: string }>(`/residents/${id}/reset-password`, { method: 'POST' }),

  getPendingUsers: () => request<User[]>('/users/pending'),

  updatePendingRegistration: (id: number, data: Record<string, unknown>) =>
    request<User>(`/users/${id}/registration`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  approveUser: (id: number, monthlyFees?: number) =>
    request<User>(`/users/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ monthlyFees }),
    }),

  rejectUser: (id: number, reason?: string) =>
    request<User>(`/users/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  getBills: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Bill[]>(`/bills${qs}`);
  },

  issueMonthlyBills: (period: string, dueDate: string) =>
    request<{ issued: number }>('/bills/issue-monthly', {
      method: 'POST',
      body: JSON.stringify({ period, dueDate }),
    }),

  createExtraBill: (data: {
    residentId: number;
    title: string;
    amount: number;
    dueDate: string;
    notes?: string;
  }) =>
    request<Bill>('/bills/extra', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  payBill: (id: number, amount: number, notes?: string) =>
    request(`/bills/${id}/pay`, { method: 'POST', body: JSON.stringify({ amount, notes }) }),

  getPayments: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<PaymentProof[]>(`/payments${qs}`);
  },

  uploadPaymentProof: (billId: number, amount: number, file: File, notes?: string) => {
    const form = new FormData();
    form.append('billId', String(billId));
    form.append('amount', String(amount));
    if (notes) form.append('notes', notes);
    form.append('file', file);
    return request<PaymentProof>('/payments', { method: 'POST', body: form });
  },

  approvePayment: (id: number, reviewNotes?: string) =>
    request<PaymentProof>(`/payments/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewNotes }),
    }),

  rejectPayment: (id: number, reviewNotes?: string) =>
    request<PaymentProof>(`/payments/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewNotes }),
    }),

  getTransactions: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Transaction[]>(`/transactions${qs}`);
  },

  getServices: (manage?: boolean) =>
    request<Service[]>(`/services${manage ? '?manage=true' : ''}`),

  getMyServices: () =>
    request<{ isServiceProvider: boolean; services: Service[]; service: Service | null }>('/services/my'),

  saveMyService: (data: {
    serviceType: string;
    serviceName: string;
    mobile: string;
    notes?: string | null;
  }) =>
    request<{ message: string; service: Service }>('/services/my', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  createService: (data: Partial<Service> & { residentId?: number | null }) =>
    request<Service>('/services', { method: 'POST', body: JSON.stringify(data) }),

  updateService: (id: number, data: Partial<Service> & { residentId?: number | null }) =>
    request<Service>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  toggleService: (id: number) =>
    request<Service>(`/services/${id}/toggle`, { method: 'PATCH' }),

  deleteService: (id: number) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),

  setServiceProvider: (enabled: boolean) =>
    request<{ message: string; resident: Resident }>('/services/provider', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  getServiceTypes: (manage?: boolean) =>
    request<ServiceType[]>(`/service-types${manage ? '?manage=true' : ''}`),

  createServiceType: (name: string) =>
    request<ServiceType>('/service-types', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateServiceType: (id: number, data: { name?: string; activeFlag?: string }) =>
    request<ServiceType>(`/service-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleServiceType: (id: number) =>
    request<ServiceType>(`/service-types/${id}/toggle`, { method: 'PATCH' }),

  deleteServiceType: (id: number) =>
    request<void>(`/service-types/${id}`, { method: 'DELETE' }),

  getUnitTypes: (manage?: boolean) =>
    request<UnitType[]>(`/unit-types${manage ? '?manage=true' : ''}`),

  createUnitType: (data: { name: string; monthlyFees: number; hasFloor: boolean; hasApartment: boolean; showOnRegister?: boolean }) =>
    request<UnitType>('/unit-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUnitType: (id: number, data: { name?: string; monthlyFees?: number; hasFloor?: boolean; hasApartment?: boolean; showOnRegister?: boolean; activeFlag?: string }) =>
    request<UnitType>(`/unit-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleUnitType: (id: number) =>
    request<UnitType>(`/unit-types/${id}/toggle`, { method: 'PATCH' }),

  deleteUnitType: (id: number) =>
    request<void>(`/unit-types/${id}`, { method: 'DELETE' }),

  getExpenseTypes: (manage?: boolean) =>
    request<ExpenseType[]>(`/expense-types${manage ? '?manage=true' : ''}`),

  createExpenseType: (name: string) =>
    request<ExpenseType>('/expense-types', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateExpenseType: (id: number, data: { name?: string; activeFlag?: string }) =>
    request<ExpenseType>(`/expense-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleExpenseType: (id: number) =>
    request<ExpenseType>(`/expense-types/${id}/toggle`, { method: 'PATCH' }),

  deleteExpenseType: (id: number) =>
    request<void>(`/expense-types/${id}`, { method: 'DELETE' }),

  getExpenses: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Expense[]>(`/expenses${q}`);
  },

  createExpense: (data: {
    expenseTypeId: number;
    amount: number;
    expenseDate: string;
    notes?: string | null;
    residentId?: number | null;
    scope: 'COMPOUND' | 'UNIT';
  }) =>
    request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateExpense: (
    id: number,
    data: {
      expenseTypeId?: number;
      amount?: number;
      expenseDate?: string;
      notes?: string | null;
      residentId?: number | null;
      scope?: 'COMPOUND' | 'UNIT';
    }
  ) =>
    request<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteExpense: (id: number) =>
    request<void>(`/expenses/${id}`, { method: 'DELETE' }),

  getNotifications: (unreadOnly?: boolean) =>
    request<Notification[]>(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`),

  getUnreadCount: () => request<{ count: number }>('/notifications/unread-count'),

  markNotificationRead: (id: number) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),

  runReminders: () => request('/notifications/run-reminders', { method: 'POST' }),

  sendNotification: (data:
    | { target: 'area'; areas: string[]; title: string; message: string }
    | { target: 'building'; area: string; buildings: string[]; title: string; message: string }
    | { target: 'owner'; residentId: number; title: string; message: string }
  ) =>
    request<{ sent: number; recipients: unknown[] }>('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getContactRequests: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ContactRequest[]>(`/contact-requests${q}`);
  },

  createContactRequest: (data: { category: string; subject: string; message: string }) =>
    request<ContactRequest>('/contact-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateContactRequest: (id: number, data: { status: string; staffResponse?: string }) =>
    request<ContactRequest>(`/contact-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getDependents: (residentId?: number) => {
    const q = residentId ? `?residentId=${residentId}` : '';
    return request<Dependent[]>(`/dependents${q}`);
  },

  createDependent: (data: {
    name: string;
    relation: string;
    mobile: string;
    email: string;
    residentId?: number;
  }) =>
    request<Dependent>('/dependents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDependent: (
    id: number,
    data: Partial<{ name: string; relation: string; mobile: string; email: string | null }>
  ) =>
    request<Dependent>(`/dependents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  resetDependentPassword: (id: number) =>
    request<{ message: string }>(`/dependents/${id}/reset-password`, { method: 'POST' }),

  deleteDependent: (id: number) =>
    request(`/dependents/${id}`, { method: 'DELETE' }),

  getUsers: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<User[]>(`/users${q}`);
  },

  getChats: () => request<ChatGroupSummary[]>('/chats'),

  createChat: (data: { name: string; description?: string | null; memberIds?: number[] }) =>
    request<ChatGroupDetail>('/chats', { method: 'POST', body: JSON.stringify(data) }),

  reorderChats: (orderedIds: number[]) =>
    request<{ message: string; orderedIds: number[] }>('/chats/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  getChat: (id: number) => request<ChatGroupDetail>(`/chats/${id}`),

  updateChat: (id: number, data: { name?: string; description?: string | null }) =>
    request<ChatGroupSummary>(`/chats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteChat: (id: number) => request(`/chats/${id}`, { method: 'DELETE' }),

  addChatMembers: (id: number, userIds: number[]) =>
    request<ChatMember[]>(`/chats/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),

  removeChatMember: (id: number, userId: number) =>
    request(`/chats/${id}/members/${userId}`, { method: 'DELETE' }),

  requestChatJoin: (id: number) =>
    request<ChatJoinRequest>(`/chats/${id}/join`, { method: 'POST' }),

  leaveChat: (id: number) =>
    request<{ message: string }>(`/chats/${id}/leave`, { method: 'POST' }),

  getChatJoinRequests: (id: number, status?: string) => {
    const q = status ? `?status=${status}` : '';
    return request<ChatJoinRequest[]>(`/chats/${id}/join-requests${q}`);
  },

  approveChatJoin: (id: number, requestId: number) =>
    request<{ message: string }>(`/chats/${id}/join-requests/${requestId}/approve`, {
      method: 'POST',
    }),

  rejectChatJoin: (id: number, requestId: number) =>
    request<{ message: string }>(`/chats/${id}/join-requests/${requestId}/reject`, {
      method: 'POST',
    }),

  getChatMessages: (id: number, params?: { limit?: number; beforeId?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.beforeId) q.set('beforeId', String(params.beforeId));
    const qs = q.toString() ? `?${q}` : '';
    return request<ChatMessage[]>(`/chats/${id}/messages${qs}`);
  },

  sendChatMessage: (id: number, body: string) =>
    request<ChatMessage>(`/chats/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  sendChatAttachment: (
    id: number,
    file: File,
    options?: { body?: string; messageType?: 'FILE' | 'AUDIO' }
  ) => {
    const form = new FormData();
    form.append('file', file);
    if (options?.body) form.append('body', options.body);
    if (options?.messageType) form.append('messageType', options.messageType);
    return request<ChatMessage>(`/chats/${id}/messages`, { method: 'POST', body: form });
  },
};
