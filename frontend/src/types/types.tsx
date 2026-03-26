import type React from 'react';

// Union Types and Enums
export type UserRole = 'Admin' | 'Editor' | 'Viewer';
export type UserStatus = 'active' | 'inactive' | 'pending';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type EntityStatus = 'active' | 'inactive' | 'draft';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Make {
  id: string;
  Name: string;
  Description: string;
  IsActive: boolean;
  CreatedBy: string;
  UpdatedBy: string;
  CreatedByName: string;
  UpdatedByName: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ApplicantDocument {
  id: string;
  ApplicantID: string;
  OriginalFileName: string;
  FilePath: string;
  FileSize: number;
  MimeType: string;
  CreatedBy?: string;
  UpdatedBy?: string;
  CreatedAt: string;
  UpdatedAt: string;
  Label?: string;
  StreamUrl?: string;
}

export interface Applicant {
  id: string;
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  Address: string;
  ContactNo?: string;
  Gender?: string;
  documents?: ApplicantDocument[];
  Documents?: ApplicantDocument[];
  CreatedBy?: string;
  UpdatedBy?: string;
  CreatedByName?: string;
  UpdatedByName?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface FranchiseRenewal {
  ExpiryDate: string;
  ORNo: string;
  Amount: number;
  LastRenewalDate: string;
  Route: string;
}

export interface Franchise {
  id: string;
  histID: string;
  rn: string;
  FranchiseNo: string;
  ApplicantID: string;
  ApplicantName: string; // Combined name for display
  ContactNo: string;
  Address: string;
  Driver?: string;
  DateIssued: string;
  Route: string;
  MakeID: string;
  MakeName: string;
  ChassisNo: string;
  EngineNo: string;
  PlateNo: string;
  Status: 'new' | 'renew' | 'drop';
  DropReason: string;
  RenewalCount: number;
  LastRenewalDate: string;
  ExpiryDate: string;
  LatestExpiryDate: string;
  CreatedBy: string;
  UpdatedBy: string;
  CreatedByName: string;
  UpdatedByName: string;
  CreatedAt: string;
  UpdatedAt: string;
  ORNo: string;
  Amount: number;
}

export interface User {
  id: string;
  UserID: string;
  FirstName: string;
  LastName: string;
  UserType: UserRole;
  LastLogin: string;
}

export interface AlertNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// Notification Types
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_date: string;
  action_url?: string;
}

// Search and Filter Types
export interface SearchFilters {
  query?: string;
  role?: UserRole;
  status?: UserStatus | EntityStatus;
  sector?: string;
  department?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type ID = string | number;
export type Timestamp = string; // ISO 8601 format

// Component Props Types
export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Context State Types
export interface LoadingState {
  isLoading: boolean;
  error?: string;
  message?: string;
}

export interface MakeContextType {
  makes: Make[];
  loading: LoadingState;
  selectedMake?: Make | null | undefined;
  pagination?: any | undefined;
  fetchMakeList: () => Promise<{success: boolean, message?: string, error?: string}>; 
  fetchMakes: () => Promise<{success: boolean, message?: string, error?: string}>;
  createMake: (make: Omit<Make, 'id'>) => Promise<{success: boolean, message?: string, error?: string}>;
  updateMake: (id: number, updates: Partial<Make>) => Promise<{success: boolean, message?: string, error?: string}>;
  deleteMake: (id: number) => Promise<{success: boolean, message?: string, error?: string}>;
  selectMake: (make: Make | undefined) => void;
  getMakeById: (id: number) => Make | undefined;
}

export interface FranchiseContextType {
  franchises: Franchise[];
  loading: LoadingState;
  selectedFranchise?: Franchise | null | undefined;
  statistics?: any | undefined;
  pagination?: any | undefined;
  fetchFranchises: () => Promise<{success: boolean, message?: string, error?: string}>;
  createFranchise: (franchise: Omit<Franchise, 'id'>) => Promise<{success: boolean, message?: string, error?: string}>;
  updateFranchise: (id: number, updates: Partial<Franchise>) => Promise<{success: boolean, message?: string, error?: string}>;
  deleteFranchise: (id: number) => Promise<{success: boolean, message?: string, error?: string}>;
  selectFranchise: (franchise: Franchise | undefined) => void;
  getFranchiseById: (id: number) => Franchise | undefined;
  fetchStatistics: () => Promise<{success: boolean, message?: string, error?: string}>;
}

export interface BasicResponse<T> {
  success: boolean;
  data: T | T[] | null;
  message?: string;
  error?: string;
}

export interface Pagination {
  current_page: number, 
  per_page: number;
  total: number;
  total_pages: number;
}

export interface MakeFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserFilters{
  search?: string;
  page?: number;
  limit?: number;
}

export interface FranchiseFilters {
  status?: string;
  make_id?: number | string;
  route?: string;
  year?: number | string;
  search?: string;
  page?: number;
  limit?: number;
}
