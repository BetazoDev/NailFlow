
# NailFlow — Technical System Specification

## 1. System Overview
NailFlow is a booking and management platform designed for nailtech businesses. The system allows clients to book services online while allowing the business to manage services, staff, appointments, payments, and automation.

The platform architecture is designed for single-tenant deployments, meaning each nailtech business runs its own instance of the system.

Core capabilities:
- Online booking
- Deposit payments
- Staff management
- Service management
- Appointment calendar
- Client management
- WhatsApp automation via n8n
- Reference image uploads
- Automated image cleanup

---

## 2. Technology Stack

Frontend
- Next.js (App Router)
- React
- TailwindCSS
- Mobile-first responsive design

Backend
- Node.js
- Express.js REST API

Database
- PostgreSQL

Automation
- n8n (webhooks)

File Storage
- Custom CDN

Deployment
- Dokploy

Version Control
- GitHub

---

## 3. System Architecture

Client Browser
↓
Next.js Frontend
↓
Express API (Node.js)
↓
PostgreSQL Database

External Services:
- Payment providers
- n8n automation
- CDN image storage

---

## 4. Booking Workflow

1. Splash Screen
2. Welcome Screen
3. Service Selection
4. Date and Time Selection
5. Reference Image Upload (optional)
6. Booking Summary
7. Deposit Payment
8. Booking Confirmation

Rules:
- Deposit required before confirmation
- Minimum booking window: 7 days

---

## 5. Booking Links

Root booking page:
domain.com

Staff booking link:
domain.com/book/{staff-slug}

Example:
domain.com/book/lidia

Bookings from staff links automatically assign that staff member.

---

## 6. User Roles

Super User
- system configuration
- manage services
- manage staff
- configure payments

Director
- business manager
- manage staff
- manage services
- view dashboard

Staff
- receives assigned appointments
- has booking link

---

## 7. Database Schema

### businesses
id
name
logo_url
brand_color_primary
brand_color_secondary
system_mode
created_at

### staff
id
business_id
name
role
phone
profile_image
booking_slug
is_active
created_at

roles:
director
staff

### services
id
business_id
name
description
price
duration_minutes
deposit_percentage
is_active
created_at

### clients
id
name
phone
notes
created_at

### bookings
id
business_id
client_id
staff_id
service_id
booking_date
start_time
status
deposit_amount
payment_status
created_at

status:
pending
confirmed
cancelled

payment_status:
pending
paid
failed

### payments
id
booking_id
amount
payment_method
payment_status
transaction_id
created_at

### reference_images
id
booking_id
image_url
uploaded_at

### system_settings
id
business_id
booking_min_days
reference_image_retention_days
created_at

---

## 8. Payment System

Bookings require deposit payment.

Deposit percentage defined per service.

Example:
Service price: $100
Deposit: 30%
Deposit required: $30

Supported methods:
- MercadoPago
- Apple Pay
- Credit/Debit Card
- Test Payment (demo mode)

Booking confirmed only after successful payment.

---

## 9. Reference Image System

Clients can upload nail inspiration images.

Rules:
- Upload only after payment confirmation
- Maximum 3 images
- Images linked to booking_id
- Stored via CDN

---

## 10. Automatic Image Cleanup

Reference images delete automatically after 14 days.

Applies only to reference images.

Does not apply to:
- business logos
- staff profile images

Cleanup executed via scheduled job.

---

## 11. Dashboard Modules

Dashboard Home
Appointments Agenda
Services
Calendar
Clients
Staff
Payments
Media Settings
Business Settings

---

## 12. Dashboard Features

Dashboard Home
- greeting
- daily earnings
- today's bookings

Agenda
- chronological appointment list

Services
- list and edit services

Calendar
- monthly appointment overview

Clients
- client database

Staff
- manage nail technicians

---

## 13. API Routes

Public

GET /services
GET /staff/{slug}
POST /booking/create
POST /payment/process
POST /reference-images/upload

Dashboard

GET /dashboard/bookings
GET /dashboard/services
POST /dashboard/services/create
PUT /dashboard/services/update
DELETE /dashboard/services/delete

GET /dashboard/staff
POST /dashboard/staff/create
PUT /dashboard/staff/update
DELETE /dashboard/staff/delete

GET /dashboard/settings
PUT /dashboard/settings/update

GET /dashboard/payments

---

## 14. Automation (n8n)

Webhook triggers:

Booking Created
24h Appointment Reminder

Messages sent to:
- Client
- Assigned nailtech

---

## 15. UI Design System

Style:
Minimal
Feminine
Card-based layout

Colors:
Primary: Pastel Pink
Secondary: Soft Rose
Background: White / Light Pink
Accent: Lavender

Components:
Rounded cards
Soft shadows
Clean spacing

---

## 16. Responsive Design

Mobile-first.

Desktop displays centered mobile container.

Maximum width:
520px

---

## 17. Environment Variables

DATABASE_URL
N8N_WEBHOOK_URL
CDN_ENDPOINT
MERCADOPAGO_API_KEY
PAYMENT_TEST_MODE
BUSINESS_NAME
BRAND_COLOR_PRIMARY
BRAND_COLOR_SECONDARY

---

## 18. Deployment

Platform: Dokploy

Steps:
1. Push code to GitHub
2. Dokploy pulls repository
3. Configure environment variables
4. Connect PostgreSQL
5. Build Next.js
6. Start Express server
7. Deploy

---

## 19. Security

- API validation
- secure payment processing
- rate limiting
- image upload validation
- environment variable protection

---

## 20. Goal

Deliver a mobile-first booking system optimized for nailtech businesses that handles scheduling, payments, automation, and inspiration image management.
