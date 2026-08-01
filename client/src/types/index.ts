export type Role = 'ADMIN' | 'MANAGER' | 'CONSULTANT';

export interface CompanyContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  companyId: string;
}

export interface Company {
  id: string;
  name: string;
  legalForm?: string | null;
  siren?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  iban?: string | null;
  bic?: string | null;
  contacts?: CompanyContact[];
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  clientId: string;
}

export interface Client {
  id: string;
  name: string;
  siret?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  logo?: string | null;
  vatRate: string | number;
  contacts?: Contact[];
  _count?: { projects: number; contacts: number };
}

export interface Intermediary {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  _count?: { projects: number };
}

export interface ProjectContact {
  id: string;
  firstName: string;
  lastName: string;
  role?: string | null;
  projectId: string;
}

export type ProjectStatus = 'PROSPECT' | 'EN_COURS' | 'EN_PAUSE' | 'TERMINE' | 'ANNULE';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  dailyRate?: string | number | null;
  clientId: string;
  client?: { id: string; name: string };
  managerId?: string | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  intermediaryId?: string | null;
  intermediary?: { id: string; name: string } | null;
  contacts?: ProjectContact[];
  _count?: { assignments: number; contacts?: number };
}


export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  profile?: string | null;
  _count?: { assignments: number };
}

export interface Assignment {
  id: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string };
  projectId: string;
  project?: {
    id: string;
    name: string;
    client?: { name: string };
    intermediary?: { id: string; name: string } | null;
  };
  startDate: string;
  endDate?: string | null;
  rate?: string | number | null;
}

export type TimesheetStatus = 'DRAFT' | 'VALIDATED' | 'REJECTED';

export interface TimesheetSummary {
  userId: string;
  month: string;
  status: TimesheetStatus;
  comment?: string | null;
}

export type TimeEntryType = 'WORKED' | 'INTERNE' | 'RTT' | 'CP' | 'MALADIE' | 'AUTRE';

export interface TimeEntry {
  id: string;
  assignmentId: string;
  date: string;
  type: TimeEntryType;
  quantity: string | number;
  comment?: string | null;
  assignment?: {
    id: string;
    project?: { id: string; name: string };
    user?: { id: string; firstName: string; lastName: string };
  };
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID';

export interface InvoiceLine {
  id: string;
  assignmentId: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: string | number;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  client?: { id: string; name: string };
  periodMonth: string;
  status: InvoiceStatus;
  totalAmount: string | number;
  vatRate: string | number;
  vatAmount: string | number;
  totalWithVat: string | number;
  lines?: InvoiceLine[];
  _count?: { lines: number };
}