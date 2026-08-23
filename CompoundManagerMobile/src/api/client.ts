import { API_BASE } from '@/constants/api';
import { getToken } from '@/lib/storage';
import { File, UploadType } from 'expo-file-system';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'OWNER' | 'DEPENDENT';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  role: Role;
  status?: UserStatus;
  residentId?: number | null;
  dependentId?: number | null;
  resident?: Partial<Resident>;
  dependent?: Partial<Dependent> | null;
  mustChangePassword?: boolean;
  mustChangeUsername?: boolean;
}

export interface Bill {
  id: number;
  residentId: number;
  period: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAmount: number;
  billType?: string;
  title?: string | null;
  resident?: {
    id?: number;
    residentName: string;
    residentType?: string;
    area?: string;
    buildingNo: string;
    floorNo?: number;
    apartmentNo: string;
    mobile?: string;
  };
}

export interface Service {
  id: number;
  serviceType: string;
  serviceName: string;
  mobile: string;
  notes?: string;
  activeFlag: string;
  residentId?: number | null;
  resident?: { residentName: string; isServiceProvider?: boolean };
}

export interface ServiceType {
  id: number;
  name: string;
  activeFlag: string;
}

export interface UnitType {
  id: number;
  name: string;
  monthlyFees: number;
  hasFloor: boolean;
  hasApartment: boolean;
  activeFlag: string;
}

export interface Dependent {
  id: number;
  residentId: number;
  name: string;
  relation: string;
  mobile: string;
  email?: string | null;
  user?: { id: number; email: string; username?: string; mustChangePassword?: boolean; mustChangeUsername?: boolean; status?: string } | null;
}

export interface ChatUserRef {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface ChatJoinRequest {
  id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user?: ChatUserRef;
}

export interface ChatGroupSummary {
  id: number;
  name: string;
  description?: string | null;
  membersCount: number;
  messagesCount: number;
  isMember: boolean;
  myJoinRequest?: ChatJoinRequest | null;
  canJoin: boolean;
  canManage: boolean;
}

export interface ChatMessage {
  id: number;
  chatGroupId: number;
  userId: number;
  body: string;
  messageType?: 'TEXT' | 'FILE' | 'AUDIO';
  fileName?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt: string;
  user: ChatUserRef;
}

export const UPLOADS_BASE = API_BASE.replace(/\/api\/?$/, '');

export async function resolveUploadUrl(path?: string | null): Promise<string> {
  if (!path) return '';
  if (path.includes('.private.blob.vercel-storage.com')) {
    const token = await getToken();
    const qs = new URLSearchParams({ url: path });
    if (token) qs.set('access_token', token);
    return `${API_BASE}/media?${qs.toString()}`;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${UPLOADS_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ContactRequest {
  id: number;
  residentId: number;
  userId: number;
  category: string;
  subject: string;
  message: string;
  status: string;
  staffResponse?: string | null;
  createdAt: string;
  resident?: Partial<Resident>;
}

export interface Resident {
  id: number;
  area: string;
  buildingNo: string;
  floorNo: number;
  apartmentNo: string;
  residentType?: string;
  residentName: string;
  nationality: string;
  mobile: string;
  landLine?: string;
  email?: string;
  monthlyFees: number;
  openingBalance?: number;
  notes?: string | null;
  balance?: number;
  isServiceProvider?: boolean;
  unitTypeId?: number | null;
  unitType?: UnitType | null;
  user?: { id: number; email: string; username?: string; mustChangePassword?: boolean; mustChangeUsername?: boolean } | null;
}

export interface PaymentProof {
  id: number;
  billId: number;
  residentId?: number;
  amount: number;
  status: string;
  fileName: string;
  filePath: string;
  notes?: string;
  reviewNotes?: string;
  createdAt?: string;
  bill?: Bill;
  resident?: Partial<Resident>;
}

export interface Transaction {
  id: number;
  trxDate: string;
  residentId: number;
  trxType?: string;
  drCr: string;
  trxAmount: number;
  notes?: string;
  posted: string;
  resident?: Partial<Resident>;
}

export interface ExpenseType {
  id: number;
  name: string;
  activeFlag: string;
}

export interface Expense {
  id: number;
  expenseTypeId: number;
  amount: number;
  expenseDate: string;
  notes?: string | null;
  residentId?: number | null;
  scope: 'COMPOUND' | 'UNIT';
  expenseType?: ExpenseType;
  resident?: Partial<Resident> | null;
}

export interface DashboardStats {
  totalUnits: number;
  monthlyMaintenance: number;
  unpaidBills: number;
  totalOutstanding: number;
  unitTypeBreakdown: Array<{ name: string; count: number; monthlyFees: number; totalValue: number }>;
  totals: { count: number; value: number };
  selectedYear?: number;
  availableYears?: number[];
  yearlyMonthly?: Array<{
    monthKey: string;
    label: string;
    issuedCount: number;
    collectedCount: number;
    issued: number;
    collected: number;
    remaining: number;
    expenses: number;
    net: number;
  }>;
  yearlyTotals?: {
    issuedCount: number;
    collectedCount: number;
    issued: number;
    collected: number;
    remaining: number;
    expenses: number;
    net: number;
  };
  yearlyExpenseBreakdown?: {
    expenseTypes: Array<{ id: number; name: string }>;
    rows: Array<{ monthKey: string; label: string; total: number; byType: Record<string, number> }>;
    totals: { total: number; byType: Record<string, number> };
  };
  residentTypeBreakdown?: Array<{ name: string; count: number }>;
  monthlyTrend?: Array<{ month: string; label: string; issued: number; collected: number }>;
  overdueBills: Bill[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

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
      body: JSON.stringify({ username, password, client: 'mobile' }),
    }),

  getSuggestedUsername: () => request<{ username: string }>('/auth/suggested-username'),

  register: (data: Record<string, unknown>) =>
    request<{ message: string }>('/auth/register', {
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
    request<User>('/auth/profile', {
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

  createResident: (data: Record<string, unknown>) =>
    request<Resident>('/residents', { method: 'POST', body: JSON.stringify(data) }),

  updateResident: (id: number, data: Record<string, unknown>) =>
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

  uploadPaymentProof: async (
    billId: number,
    amount: number,
    file: { uri: string; name: string; mimeType?: string },
    notes?: string
  ) => {
    const token = await getToken();
    const mimeType =
      file.mimeType ||
      (file.name.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : file.name.toLowerCase().match(/\.(png)$/)
          ? 'image/png'
          : file.name.toLowerCase().match(/\.(jpg|jpeg)$/)
            ? 'image/jpeg'
            : 'application/octet-stream');

    // Expo's fetch rejects RN's { uri, name, type } FormData parts.
    // Use expo-file-system native multipart upload instead.
    const expoFile = new File(file.uri);
    const parameters: Record<string, string> = {
      billId: String(billId),
      amount: String(amount),
    };
    if (notes) parameters.notes = notes;

    const result = await expoFile.upload(`${API_BASE}/payments`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (result.status < 200 || result.status >= 300) {
      let message = 'فشل الرفع';
      try {
        const err = JSON.parse(result.body) as { error?: string };
        if (typeof err.error === 'string') message = err.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    return JSON.parse(result.body) as PaymentProof;
  },

  getPayments: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<PaymentProof[]>(`/payments${qs}`);
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

  setServiceProvider: (enabled: boolean) =>
    request<{ message: string }>('/services/provider', {
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

  createUnitType: (data: { name: string; monthlyFees: number; hasFloor: boolean; hasApartment: boolean }) =>
    request<UnitType>('/unit-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUnitType: (id: number, data: {
    name?: string;
    monthlyFees?: number;
    hasFloor?: boolean;
    hasApartment?: boolean;
    activeFlag?: string;
  }) =>
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

  updateExpense: (id: number, data: Record<string, unknown>) =>
    request<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteExpense: (id: number) =>
    request<void>(`/expenses/${id}`, { method: 'DELETE' }),

  createService: (data: Partial<Service> & { residentId?: number | null }) =>
    request<Service>('/services', { method: 'POST', body: JSON.stringify(data) }),

  updateService: (id: number, data: Partial<Service> & { residentId?: number | null }) =>
    request<Service>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  toggleService: (id: number) =>
    request<Service>(`/services/${id}/toggle`, { method: 'PATCH' }),

  deleteService: (id: number) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),

  getNotifications: () => request<Notification[]>('/notifications'),

  getUnreadCount: () => request<{ count: number }>('/notifications/unread-count'),

  markNotificationRead: (id: number) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),

  sendPaymentReminders: () =>
    request<{ dueReminders: number; overdueMarked: number }>('/notifications/run-reminders', {
      method: 'POST',
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

  sendNotification: (data:
    | { target: 'area'; areas: string[]; title: string; message: string }
    | { target: 'building'; area: string; buildings: string[]; title: string; message: string }
    | { target: 'owner'; residentId: number; title: string; message: string }
  ) =>
    request<{ sent: number }>('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDependents: (residentId?: number) => {
    const q = residentId ? `?residentId=${residentId}` : '';
    return request<Dependent[]>(`/dependents${q}`);
  },

  createDependent: (data: { name: string; relation: string; mobile: string; email: string; residentId?: number }) =>
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

  deleteDependent: (id: number) =>
    request(`/dependents/${id}`, { method: 'DELETE' }),

  resetDependentPassword: (id: number) =>
    request<{ message: string }>(`/dependents/${id}/reset-password`, { method: 'POST' }),

  getChats: () => request<ChatGroupSummary[]>('/chats'),

  createChatGroup: (data: { name: string; description?: string | null; memberIds?: number[] }) =>
    request<ChatGroupSummary>('/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteChatGroup: (id: number) =>
    request<void>(`/chats/${id}`, { method: 'DELETE' }),

  requestChatJoin: (id: number) =>
    request<ChatJoinRequest>(`/chats/${id}/join`, { method: 'POST' }),

  leaveChat: (id: number) =>
    request<{ message: string }>(`/chats/${id}/leave`, { method: 'POST' }),

  getChatMessages: (id: number) => request<ChatMessage[]>(`/chats/${id}/messages`),

  sendChatMessage: (id: number, body: string) =>
    request<ChatMessage>(`/chats/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  sendChatAttachment: async (
    id: number,
    file: { uri: string; name: string; mimeType?: string },
    options?: { body?: string; messageType?: 'FILE' | 'AUDIO' }
  ) => {
    const token = await getToken();
    const mimeType = file.mimeType || 'application/octet-stream';
    const expoFile = new File(file.uri);
    const parameters: Record<string, string> = {};
    if (options?.body) parameters.body = options.body;
    if (options?.messageType) parameters.messageType = options.messageType;

    const result = await expoFile.upload(`${API_BASE}/chats/${id}/messages`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (result.status < 200 || result.status >= 300) {
      let message = 'فشل الرفع';
      try {
        const err = JSON.parse(result.body) as { error?: string };
        if (typeof err.error === 'string') message = err.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    return JSON.parse(result.body) as ChatMessage;
  },
};
