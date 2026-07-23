import { API_BASE } from '@/constants/api';
import { getToken } from '@/lib/storage';
import { File, UploadType } from 'expo-file-system';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'OWNER' | 'DEPENDENT';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  status?: UserStatus;
  residentId?: number | null;
  dependentId?: number | null;
  resident?: Partial<Resident>;
  dependent?: Partial<Dependent> | null;
  mustChangePassword?: boolean;
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
    apartmentNo: number;
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
  apartmentNo: number;
  residentType?: string;
  residentName: string;
  nationality: string;
  mobile: string;
  landLine?: string;
  email?: string;
  monthlyFees: number;
  balance?: number;
  isServiceProvider?: boolean;
  unitTypeId?: number | null;
  unitType?: UnitType | null;
}

export interface PaymentProof {
  id: number;
  billId: number;
  amount: number;
  status: string;
  fileName: string;
  filePath: string;
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
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, client: 'mobile' }),
    }),

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

  updateProfile: (data: Record<string, unknown>) =>
    request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getMe: () => request<User & { resident?: Resident }>('/auth/me'),

  getMyResident: () => request<Resident>('/residents/me'),

  getBills: () => request<Bill[]>('/bills'),

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

  getServices: () => request<Service[]>('/services'),

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

  getServiceTypes: () => request<ServiceType[]>('/service-types'),

  getUnitTypes: () => request<UnitType[]>('/unit-types'),

  createService: (data: { serviceType: string; serviceName: string; mobile: string; notes?: string }) =>
    request<Service>('/services', { method: 'POST', body: JSON.stringify(data) }),

  getNotifications: () => request<Notification[]>('/notifications'),

  getUnreadCount: () => request<{ count: number }>('/notifications/unread-count'),

  markNotificationRead: (id: number) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),

  getContactRequests: () => request<ContactRequest[]>('/contact-requests'),

  createContactRequest: (data: { category: string; subject: string; message: string }) =>
    request<ContactRequest>('/contact-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDependents: () => request<Dependent[]>('/dependents'),

  createDependent: (data: { name: string; relation: string; mobile: string; email: string }) =>
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

  getChats: () => request<ChatGroupSummary[]>('/chats'),

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
