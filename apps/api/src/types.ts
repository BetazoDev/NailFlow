// ============================================
// NailFlow — TypeScript Interfaces
// ============================================

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  owner_name: string;
  phone: string;
  currency: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  category: string;
  duration_minutes: number;
  estimated_price: number;
  required_advance: number;
  image_url?: string;
  active: boolean;
}

export interface Availability {
  id: string;
  tenant_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string;  // "09:00"
  end_time: string;    // "18:00"
  is_active: boolean;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  service_id: string;
  service_name: string;
  datetime_start: string; // ISO string
  datetime_end: string;
  image_url?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  advance_paid: number;
  total_price: number;
  created_at: string;
}

export interface TimeSlot {
  time: string;       // "09:00"
  available: boolean;
}

export interface BookingData {
  tenant_id: string;
  date: string;        // "2025-03-15"
  time: string;        // "10:00"
  service_id: string;
  service_name: string;
  service_price: number;
  service_duration: number;
  client_name: string;
  client_phone: string;
  client_email?: string;
  image_url?: string;
  notes?: string;
}

export type BookingStep = 
  | 'calendar' 
  | 'time' 
  | 'service' 
  | 'image' 
  | 'personal' 
  | 'payment' 
  | 'confirmation';
