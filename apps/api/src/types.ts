export interface Tenant {
  id: string;
  domain: string;
  branding: {
    logo_url: string;
    primary_color: string;
    secondary_color: string;
  };
  settings: {
    currency: string;
    timezone: string;
  };
  owner_id: string; // Firebase Auth UID
  subscription: {
    status: 'active' | 'trial';
    plan: 'pro';
  };
}

export interface Staff {
  id: string;
  tenant_id: string;
  name: string;
  email: string; // Linked to Firebase Auth
  role: 'owner' | 'staff';
  photo_url: string;
  bio: string;
  active: boolean;
  color_identifier: string; // For calendar visualization
  services_offered: string[]; // Array of Service IDs
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
}

export interface Appointment {
  id: string;
  tenant_id: string;
  client_name: string;
  client_phone: string;
  service_id: string;
  staff_id: string;
  // Firestore timestamp in reality, but using any for simple front/back interface or typed properly if firebase-admin is present
  datetime_start: any;
  datetime_end: any;
  image_url?: string;
  status: 'pending_payment' | 'confirmed' | 'cancelled';
  advance_paid: boolean;
  payment_ref?: string; // Mercado Pago Transaction ID
  expires_at?: any; // For the temporary locking mechanism
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
  staff_id?: string;
  staff_name?: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  image_url?: string;
  notes?: string;
}

export type BookingStep =
  | 'datetime'
  | 'service'
  | 'staff'
  | 'image'
  | 'personal'
  | 'payment'
  | 'confirmation';
