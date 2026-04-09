// ============================================
// NailFlow — TypeScript Interfaces
// ============================================

export interface Tenant {
  id: string;
  domain: string;
  name?: string;
  branding: {
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    photo_url?: string;
    palette_id?: string;
    typography?: string;
    tagline?: string;
  };
  settings: {
    currency: string;
    timezone: string;
    weekly_schedule?: {
        day: number; // 0=Sun, 1=Mon, ..., 6=Sat
        active: boolean;
        start: string;
        end: string;
    }[];
    loyalty?: {
        enabled: boolean;
        visits_required: number;
        reward_type: 'discount' | 'free_service';
        discount_value?: number;
    };
  };
  owner_id: string;
  subscription: {
    status: 'active' | 'trial';
    plan: 'pro';
  };
}

export interface Staff {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  photo_url: string;
  bio: string;
  active: boolean;
  color_identifier: string;
  services_offered: string[];
  specialty?: string;
  slug?: string;
  weekly_schedule: {
    day_of_week: number;
    start_time: string;
    end_time: string;
  }[];
}

export interface Availability {
  id: string;
  tenant_id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  estimated_price: number;
  required_advance: number;
  category?: string;
  description?: string;
  image_url?: string;
  is_package?: boolean;
  included_service_ids?: string[];
}

export interface Appointment {
  id: string;
  tenant_id: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  service_id: string;
  staff_id: string;
  date: string;        // "2025-03-15"
  time: string;        // "10:00"
  datetime_start: string;
  datetime_end: string;
  price?: number;
  service_name?: string;
  service_price?: number;
  image_url?: string;
  image_urls?: string[];
  notes?: string;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
  advance_paid: boolean;
  payment_ref?: string;
  expires_at?: string;
  service?: Service;
}

export interface TimeSlot {
  time: string;       // "09:00"
  available: boolean;
}

export interface Client {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  preferences?: string;
  allergies?: string;
  visits: number;
  lastVisit: string;
  lastService?: string;
  totalSpent: number;
  services: string[];
  favorite?: boolean;
}

export interface BookingData {
  tenant_id: string;
  date: string;        // "2025-03-15"
  time: string;        // "10:00"
  service_id: string;
  service_name: string;
  service_price: number;
  service_duration: number;
  service_required_advance?: number;
  selected_services?: Service[];
  total_price?: number;
  total_duration?: number;
  total_required_advance?: number;
  staff_id?: string;
  staff_name?: string;
  staff_photo?: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  image_url?: string;
  image_urls?: string[];
  notes?: string;
  payment_method?: string;
}

export type BookingStep = 'personal' | 'service' | 'datetime' | 'inspiration' | 'summary' | 'payment' | 'confirmation';

export type PaymentMethod = 'prueba' | 'card' | 'apple' | 'google' | 'stripe' | 'paypal' | 'mercado';
