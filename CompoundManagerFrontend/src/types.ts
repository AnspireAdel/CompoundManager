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
  createdAt?: string;
}

export interface Resident {
  id: number;
  area: string;
  buildingNo: string;
  floorNo: number;
  apartmentNo: string;
  residentType: string;
  residentName: string;
  nationality: string;
  mobile: string;
  landLine?: string;
  email?: string;
  openingBalance: number;
  monthlyFees: number;
  balance?: number;
  isServiceProvider?: boolean;
  unitTypeId?: number | null;
  unitType?: UnitType | null;
  notes?: string | null;
  user?: { id: number; email: string; mustChangePassword?: boolean } | null;
}

export interface UnitType {
  id: number;
  name: string;
  monthlyFees: number;
  hasFloor: boolean;
  hasApartment: boolean;
  activeFlag: string;
  createdAt?: string;
}

export interface Dependent {
  id: number;
  residentId: number;
  name: string;
  relation: string;
  mobile: string;
  email?: string | null;
  createdAt?: string;
  resident?: { id: number; residentName: string; area: string; buildingNo: string };
  user?: { id: number; email: string; mustChangePassword?: boolean; status?: string } | null;
}

export interface PaymentProof {
  id: number;
  billId: number;
  residentId: number;
  userId: number;
  amount: number;
  fileName: string;
  filePath: string;
  fileMime: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  reviewNotes?: string;
  createdAt: string;
  bill?: Bill;
  resident?: Partial<Resident>;
  user?: Partial<User>;
}

export interface Bill {
  id: number;
  residentId: number;
  period: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAmount: number;
  billType?: 'MONTHLY' | 'EXTRA' | string;
  title?: string | null;
  notes?: string | null;
  resident?: Partial<Resident>;
  paymentProofs?: PaymentProof[];
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

export interface Service {
  id: number;
  residentId?: number | null;
  serviceType: string;
  serviceName: string;
  mobile: string;
  landLine?: string;
  email?: string;
  notes?: string;
  activeFlag: string;
  resident?: Partial<Resident> & { isServiceProvider?: boolean };
}

export interface ServiceType {
  id: number;
  name: string;
  activeFlag: string;
  createdAt?: string;
}

export interface ExpenseType {
  id: number;
  name: string;
  activeFlag: string;
  createdAt?: string;
}

export interface Expense {
  id: number;
  expenseTypeId: number;
  amount: number;
  expenseDate: string;
  notes?: string | null;
  residentId?: number | null;
  createdById?: number | null;
  createdAt?: string;
  updatedAt?: string;
  expenseType?: ExpenseType;
  resident?: Partial<Resident> & {
    unitType?: { name: string; hasFloor?: boolean; hasApartment?: boolean } | null;
  } | null;
  createdBy?: { id: number; name: string; email: string } | null;
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
  category: 'REQUEST' | 'INQUIRY' | 'COMPLAINT' | string;
  subject: string;
  message: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  staffResponse?: string | null;
  reviewedById?: number | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  resident?: Partial<Resident>;
  user?: { id: number; name: string; email: string };
}

export interface DashboardStats {
  totalUnits: number;
  monthlyMaintenance: number;
  unpaidBills: number;
  totalOutstanding: number;
  unitTypeBreakdown: Array<{
    name: string;
    count: number;
    monthlyFees: number;
    totalValue: number;
  }>;
  totals: { count: number; value: number };
  billStatusBreakdown?: Array<{ name: string; count: number; amount: number }>;
  residentTypeBreakdown?: Array<{ name: string; count: number }>;
  monthlyTrend?: Array<{ month: string; label: string; issued: number; collected: number }>;
  selectedYear?: number;
  availableYears?: number[];
  yearlyMonthly?: Array<{
    month: number;
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
    rows: Array<{
      month: number;
      monthKey: string;
      label: string;
      total: number;
      byType: Record<string, number>;
    }>;
    totals: { total: number; byType: Record<string, number> };
  };
  totalResidents?: number;
  totalBills?: number;
  totalServices?: number;
  unreadNotifications?: number;
  recentBills?: Bill[];
  overdueBills: Bill[];
}

export interface ChatUserRef {
  id: number;
  name: string;
  email: string;
  role: Role;
  resident?: {
    area?: string;
    buildingNo?: string;
    mobile?: string;
  } | null;
  dependent?: {
    mobile?: string;
  } | null;
}

export interface ChatJoinRequest {
  id: number;
  chatGroupId?: number;
  userId?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user?: ChatUserRef;
}

export interface ChatGroupSummary {
  id: number;
  name: string;
  description?: string | null;
  sortOrder?: number;
  createdBy?: ChatUserRef;
  createdAt: string;
  updatedAt: string;
  membersCount: number;
  messagesCount: number;
  isMember: boolean;
  joinedAt?: string | null;
  myJoinRequest?: ChatJoinRequest | null;
  canJoin: boolean;
  canManage: boolean;
}

export interface ChatMember {
  id: number;
  chatGroupId: number;
  userId: number;
  joinedAt: string;
  user: ChatUserRef;
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

export interface ChatGroupDetail extends Omit<ChatGroupSummary, 'membersCount' | 'messagesCount' | 'canJoin' | 'myJoinRequest'> {
  members: ChatMember[];
  joinRequests: ChatJoinRequest[];
  _count?: { members: number; messages: number };
}
