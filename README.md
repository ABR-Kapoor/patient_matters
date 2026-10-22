# AuraSutra Patient Portal

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Payment-072654?style=flat-square)](https://razorpay.com/)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)]()

The **Patient Portal** of the AuraSutra Ayurvedic Healthcare Platform. A full-featured Next.js 14 application that enables patients to discover Ayurvedic practitioners, book appointments with integrated payments, attend video consultations, track medication adherence, and manage their health journey -- all with multi-language support across 14 languages.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [User Flow](#user-flow)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Key Components](#key-components)
- [Internationalization](#internationalization)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Deployment](#deployment)

---

## Architecture Overview

```
+---------------------------------------------------------------------+
|                        PATIENT PORTAL (Port 3000)                   |
|                         Next.js 14 App Router                       |
+---------------------------------------------------------------------+
|                                                                     |
|  +-------------------+   +-------------------+   +----------------+ |
|  |   Landing Page    |   |    Dashboard      |   |   Video Call   | |
|  | - AI Doctor Search|   | - Stats & Charts  |   | - ZegoCloud    | |
|  | - Voice Input     |   | - Quick Actions   |   | - Synced Timer | |
|  | - Language Switch |   | - Notifications   |   | - Call Tracking| |
|  +-------------------+   +-------------------+   +----------------+ |
|                                                                     |
|  +-------------------+   +-------------------+   +----------------+ |
|  |  Find Doctors     |   | Book Appointment  |   | Prescriptions  | |
|  | - Search & Filter |   | - Date/Time Pick  |   | - View Rx      | |
|  | - Specialization  |   | - Razorpay Pay    |   | - Dose Details | |
|  | - City Filter     |   | - Confirmation    |   | - Doctor Notes | |
|  +-------------------+   +-------------------+   +----------------+ |
|                                                                     |
|  +-------------------+   +-------------------+   +----------------+ |
|  |  Medications      |   |  Patient Profile  |   |  Components    | |
|  | - Adherence Track |   | - Medical Info    |   | - LiveCallNote | |
|  | - Mark Taken/Skip |   | - Allergies       |   | - MedicinePopup| |
|  | - Daily Reminders |   | - Conditions      |   | - LangSwitcher | |
|  +-------------------+   +-------------------+   +----------------+ |
|                                                                     |
+---------------------------+-----------------------------------------+
                            |
              +-------------+-------------+
              |        API Layer          |
              |    25+ REST Endpoints     |
              +--+------+------+------+---+
                 |      |      |      |
    +--------+   |   +--+--+  |   +--+-------+
    | Kinde  |---+   |Neon |  |   | Razorpay |
    | Auth   |       |Pg DB|  |   | Payments |
    +--------+       +-----+  |   +----------+
                               |
              +-------+--------+--------+-------+
              |       |        |        |       |
          +---+--+ +--+---+ +-+----+ +-+-----+ |
          | Zego | |Nhost | |Resend| |Lingo  | |
          |Cloud | |Files | |Email | |.dev   | |
          +------+ +------+ +------+ +-------+ |
           Video    Storage   Notify  Translate |
                                                |
                                          +-----+------+
                                          | Web Speech |
                                          |    API     |
                                          +------------+
                                           Voice Input
```

---

## Tech Stack

| Layer            | Technology                                          |
|------------------|-----------------------------------------------------|
| Framework        | Next.js 14 (App Router)                             |
| UI Library       | React 18                                            |
| Language         | TypeScript 5.3                                      |
| Database         | PostgreSQL via Neon (serverless), `postgres` driver  |
| Authentication   | Kinde Auth (Google OAuth)                           |
| Payments         | Razorpay payment gateway                            |
| Video Calls      | ZegoCloud UIKit Prebuilt                            |
| File Storage     | Nhost                                               |
| Email            | Resend API                                          |
| Translation      | Lingo.dev SDK (14 languages)                        |
| Voice Input      | Web Speech API                                      |
| Charts           | Recharts                                            |
| Styling          | Tailwind CSS 3.4 + tailwindcss-animate              |
| UI Components    | Radix UI primitives                                 |
| Icons            | Lucide React                                        |
| Animations       | Framer Motion                                       |
| Notifications    | react-hot-toast                                     |
| Date Utilities   | date-fns                                            |
| Port             | 3000                                                |

---

## Project Structure

```
patient_view/
|
|-- app/
|   |-- api/                                # API Routes (25+ endpoints)
|   |   |-- ai-doctor-search/              #   AI symptom-based doctor matching
|   |   |-- appointments/
|   |   |   |-- create/                    #   POST - Create appointment
|   |   |   |-- [aid]/
|   |   |       |-- status/               #   GET  - Appointment status
|   |   |       |-- call-duration/         #   PATCH - Update call duration
|   |   |-- auth/[kindeAuth]/              #   Kinde authentication handler
|   |   |-- calls/check-active/            #   GET  - Active call detection
|   |   |-- doctors/                       #   GET  - Doctor listing & details
|   |   |-- notifications/send/            #   POST - Email notifications
|   |   |-- patient/                       #   Patient data endpoints
|   |   |   |-- profile/                   #     GET/PATCH - Profile CRUD
|   |   |   |-- dashboard/                 #     GET - Dashboard statistics
|   |   |   |-- adherence/                 #     GET/PATCH - Medication adherence
|   |   |   |-- prescriptions/             #     GET - Prescription data
|   |   |   |-- appointments/              #     GET/POST - Appointments
|   |   |   |-- active-calls/              #     GET - Active video calls
|   |   |-- payments/
|   |   |   |-- create-order/              #   POST - Razorpay order creation
|   |   |   |-- verify/                    #   POST - Payment verification
|   |   |   |-- record-transaction/        #   POST - Finance transaction log
|   |   |-- sync-user/                     #   GET  - Sync Kinde user to DB
|   |   |-- translate/                     #   POST - Multi-language translation
|   |   |-- upload/                        #   POST - Image upload to Nhost
|   |
|   |-- dashboard/
|   |   |-- page.tsx                       # Main dashboard (stats, charts, actions)
|   |   |-- find-doctors/                  # Doctor search and browsing
|   |   |-- book-appointment/              # Appointment booking with payment
|   |   |-- appointments/                  # Appointment management
|   |   |-- prescriptions/                 # View prescriptions from doctors
|   |   |-- medications/                   # Medication adherence tracker
|   |   |-- profile/                       # Patient profile editor
|   |   |-- doctors/                       # Doctor detail views
|   |   |-- video-call/[aid]/              # ZegoCloud video consultation
|   |   |-- components/                    # Dashboard-specific components
|   |   |   |-- DashboardLayoutClient.tsx  #   Collapsible sidebar layout
|   |   |   |-- DashboardNav.tsx           #   Navigation bar
|   |   |   |-- Sidebar.tsx                #   Sidebar navigation
|   |   |   |-- LiveCallNotifier.tsx       #   Real-time call notifications
|   |   |   |-- DoctorProfileModal.tsx     #   Doctor profile for booking
|   |   |   |-- PaymentStatusBadge.tsx     #   Payment status indicator
|   |   |   |-- ProfileEditModal.tsx       #   Profile editing modal
|   |   |-- layout.tsx                     # Dashboard layout with auth guard
|   |
|   |-- components/                        # Shared application components
|   |   |-- AdherenceCheckbox.tsx           #   Dose taken/skipped toggle
|   |   |-- DailyMedicinePopup.tsx          #   Daily medicine reminder
|   |   |-- DashboardAdherenceWidget.tsx    #   Adherence chart widget
|   |   |-- LanguageSwitcher.tsx            #   14-language selector
|   |   |-- PrescriptionNotification.tsx    #   New prescription alerts
|   |   |-- TranslatedText.tsx              #   Dynamic text translation
|   |   |-- ProfilePicture.tsx              #   Profile image component
|   |
|   |-- contexts/
|   |   |-- LanguageContext.tsx             # Language state provider
|   |
|   |-- hooks/
|   |   |-- useTranslation.ts              # Translation hook with caching
|   |   |-- useVoiceToText.ts              # Web Speech API voice input hook
|   |
|   |-- lib/                               # App-level translation cache
|   |
|   |-- page.tsx                           # Landing page (AI search + voice)
|   |-- layout.tsx                         # Root layout
|
|-- components/                            # Root-level components
|   |-- PatientProfileCheck.tsx            #   Profile completeness checker
|   |-- ProfileCompletionBanner.tsx        #   Completion progress banner
|   |-- ProfileCompletionModal.tsx         #   Profile completion modal
|
|-- lib/
|   |-- db.ts                             # PostgreSQL connection (Neon)
|   |-- upload.ts                         # Nhost upload helper
|   |-- shared/
|       |-- index.ts                      # Shared module exports
|       |-- types.ts                      # TypeScript type definitions
|       |-- utils.ts                      # Utility functions
|       |-- greetings.ts                  # Multi-language greetings
|       |-- auth-helpers.ts               # Authentication utilities
|       |-- profile-utils.ts              # Profile helper functions
|       |-- notifications/
|           |-- email.ts                  # Email sending via Resend
|           |-- templates.ts              # Email templates (3 types)
|
|-- types/
|   |-- razorpay.d.ts                     # Razorpay type definitions
|
|-- public/                               # Static assets
|   |-- Logos/                            # Brand logos
|   |-- logo_transparent.png              # Transparent logo
|   |-- landing-bg.jpg                    # Landing page background
|   |-- health_tech_bg.png                # Health tech background
|
|-- next.config.js                        # Next.js configuration
|-- tailwind.config.ts                    # Tailwind CSS configuration
|-- tsconfig.json                         # TypeScript configuration
|-- postcss.config.js                     # PostCSS configuration
|-- vercel.json                           # Vercel deployment config
|-- package.json                          # Dependencies and scripts
|-- Project_DB.sql                        # Database schema
|-- Project_DB_Functions.sql              # Database functions
|-- complete_tables.sql                   # Complete table definitions
```

---

## Key Features

### 1. AI-Powered Doctor Search
Symptom-based doctor matching using an AI endpoint. Patients describe their symptoms in natural language (typed or via voice input), and the system recommends the most suitable Ayurvedic practitioners based on specialization relevance.

### 2. Voice-to-Text Symptom Input
Built on the Web Speech API, the `useVoiceToText` hook allows patients to describe symptoms using their voice. Works directly in the browser without any external dependencies.

### 3. Doctor Discovery
Browse and search verified Ayurvedic doctors with filters for specialization and city. Each doctor has a detailed profile modal showing qualifications, experience, consultation fees, and availability.

### 4. Appointment Booking with Razorpay Payments
End-to-end booking flow: select doctor, choose date/time, complete payment via Razorpay, and receive email confirmation. Payment verification is handled server-side with cryptographic signature validation.

### 5. Video Consultations
1-on-1 video calls powered by ZegoCloud with a synchronized timer. The system tracks call duration and updates appointment records. Supports full-screen video with audio/video controls.

### 6. Live Call Notifications
The `LiveCallNotifier` component polls every 5 seconds for active calls. When a doctor initiates a call, the patient hears a ringtone and sees a "Join Now" button for immediate connection.

### 7. Prescription Management
View prescriptions issued by doctors after consultations. Each prescription includes medication details, dosage instructions, frequency, and duration.

### 8. Medication Adherence Tracking
Track daily medication intake by marking each dose as taken or skipped. The system calculates adherence percentages and displays trends over time using Recharts visualizations.

### 9. Daily Medicine Reminders
The `DailyMedicinePopup` component shows a daily reminder of pending medications, helping patients stay on track with their prescribed regimen.

### 10. Patient Profile Management
Comprehensive profile editor for medical information including allergies, existing conditions, current medications, blood group, and emergency contacts. A profile completeness banner encourages users to fill in all fields.

### 11. Multi-Language Support (14 Languages)
Full internationalization via Lingo.dev with both static and dynamic translation. The `LanguageSwitcher` component allows seamless switching between 14 languages. Translation results are cached for performance.

### 12. Dashboard with Real-Time Polling
Central dashboard displaying health stats, adherence charts, upcoming appointments, and quick action buttons. Polls every 10 seconds to keep data current without requiring page refreshes.

### 13. Email Notifications
Automated email notifications via Resend for three event types: appointment confirmations, prescription alerts, and payment receipts. Emails use professionally designed HTML templates.

---

## User Flow

```
+------------------+     +----------------+     +-------------------+
|   Landing Page   |---->|   Kinde Login  |---->|    Dashboard      |
| - AI Search      |     | - Google OAuth |     | - Stats & Charts  |
| - Voice Input    |     |                |     | - Quick Actions   |
| - Language Pick  |     |                |     | - Notifications   |
+------------------+     +----------------+     +--------+----------+
                                                         |
                    +------------------------------------+----+
                    |                    |                     |
           +--------v--------+  +-------v--------+  +--------v--------+
           |  Find Doctors   |  |  Appointments  |  |  Prescriptions  |
           | - Search/Filter |  | - View All     |  | - View Rx       |
           | - Specialization|  | - Status Track |  | - Dose Details  |
           | - City          |  | - Call History |  | - Doctor Notes  |
           +--------+--------+  +-------+--------+  +--------+--------+
                    |                    |                     |
           +--------v--------+  +-------v--------+  +--------v--------+
           | Book Appointment|  |  Video Call    |  |  Medications    |
           | - Select Slot   |  | - ZegoCloud   |  | - Track Doses   |
           | - Razorpay Pay  |  | - Synced Timer|  | - Mark Taken    |
           | - Confirmation  |  | - Duration Log|  | - Adherence %   |
           +-----------------+  +----------------+  +-----------------+
```

---

## API Reference

### Patient Endpoints

| Method | Endpoint                          | Description                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | `/api/sync-user`                  | Sync authenticated Kinde user to database |
| GET    | `/api/patient/profile`            | Retrieve patient profile                 |
| PATCH  | `/api/patient/profile`            | Update patient profile                   |
| GET    | `/api/patient/dashboard`          | Dashboard statistics and summary         |
| GET    | `/api/patient/appointments`       | List patient appointments                |
| POST   | `/api/patient/appointments`       | Create a new appointment                 |
| GET    | `/api/patient/prescriptions`      | List prescriptions for patient           |
| GET    | `/api/patient/adherence`          | Get medication adherence records         |
| PATCH  | `/api/patient/adherence`          | Update adherence (mark taken/skipped)    |
| GET    | `/api/patient/active-calls`       | Check for active video calls             |

### Appointment Endpoints

| Method | Endpoint                                | Description                            |
|--------|-----------------------------------------|----------------------------------------|
| POST   | `/api/appointments/create`              | Create appointment (auth-protected)    |
| GET    | `/api/appointments/[aid]/status`        | Get appointment status by ID           |
| PATCH  | `/api/appointments/[aid]/call-duration` | Update call duration for appointment   |

### Doctor Endpoints

| Method | Endpoint                   | Description                              |
|--------|----------------------------|------------------------------------------|
| GET    | `/api/doctors`             | List all verified doctors                |
| GET    | `/api/doctors/[did]`       | Get doctor details by ID                 |
| GET    | `/api/doctors/find-all`    | Retrieve all doctors (unfiltered)        |

### AI and Search

| Method | Endpoint                   | Description                              |
|--------|----------------------------|------------------------------------------|
| POST   | `/api/ai-doctor-search`    | AI symptom-based doctor matching         |

### Payment Endpoints

| Method | Endpoint                           | Description                            |
|--------|------------------------------------|----------------------------------------|
| POST   | `/api/payments/create-order`       | Create Razorpay payment order          |
| POST   | `/api/payments/verify`             | Verify Razorpay payment signature      |
| POST   | `/api/payments/record-transaction` | Record transaction in finance ledger   |

### Communication and Utilities

| Method | Endpoint                    | Description                             |
|--------|-----------------------------|-----------------------------------------|
| GET    | `/api/calls/check-active`   | Detect active video calls               |
| POST   | `/api/notifications/send`   | Send email notification (3 types)       |
| POST   | `/api/translate`            | Translate text to target language        |
| POST   | `/api/upload`               | Upload image to Nhost storage            |

### Authentication

| Method | Endpoint                    | Description                             |
|--------|-----------------------------|-----------------------------------------|
| *      | `/api/auth/[kindeAuth]`     | Kinde authentication handler (all methods) |

---

## Database Schema

The application interacts with the following PostgreSQL tables:

```
+-------------------+       +-------------------+       +-------------------+
|      users        |       |     patients      |       |     doctors       |
+-------------------+       +-------------------+       +-------------------+
| id (PK)           |<---+  | id (PK)           |  +--->| id (PK)           |
| kinde_id          |    |  | user_id (FK)      |--+    | user_id (FK)      |
| email             |    |  | blood_group       |       | specialization    |
| first_name        |    |  | allergies         |       | qualification     |
| last_name         |    |  | conditions        |       | experience        |
| role              |    |  | medications       |       | consultation_fee  |
| picture           |    +--| emergency_contact |       | city              |
| phone             |       | date_of_birth     |       | is_verified       |
| created_at        |       | gender            |       | bio               |
+-------------------+       +-------------------+       +-------------------+
         |                                                       |
         |   +-------------------+       +-------------------+   |
         |   |  appointments     |       |  prescriptions    |   |
         |   +-------------------+       +-------------------+   |
         +-->| id (PK)           |       | id (PK)           |<--+
             | patient_id (FK)   |  +--->| appointment_id(FK)|
             | doctor_id (FK)    |--+    | medication_name   |
             | date_time         |       | dosage            |
             | status            |       | frequency         |
             | payment_status    |       | duration          |
             | call_duration     |       | instructions      |
             | notes             |       | created_at        |
             +-------------------+       +-------------------+
                      |
         +------------+------------+
         |                         |
+--------v----------+   +---------v-----------+
| medication_       |   | finance_            |
| adherence         |   | transactions        |
+-------------------+   +---------------------+
| id (PK)           |   | id (PK)             |
| prescription_id   |   | appointment_id (FK) |
| patient_id (FK)   |   | amount              |
| date              |   | razorpay_order_id   |
| status            |   | razorpay_payment_id |
| created_at        |   | status              |
+-------------------+   | created_at          |
                         +---------------------+

+-------------------------------+
| doctor_patient_relationships  |
+-------------------------------+
| id (PK)                       |
| doctor_id (FK)                |
| patient_id (FK)               |
| created_at                    |
+-------------------------------+
```

---

## Authentication

Authentication is handled by **Kinde Auth** with Google OAuth as the identity provider.

**How it works:**

1. The Kinde auth handler at `/api/auth/[kindeAuth]` manages login, logout, and callback flows.
2. On first login, `/api/sync-user` syncs the Kinde user profile to the local PostgreSQL database.
3. The dashboard layout (`layout.tsx`) performs server-side authentication checks.
4. Role-based access control ensures only users with the `patient` role can access the dashboard.
5. Users with a `doctor` role are redirected to `/unauthorized`.

**Auth Helpers** (`lib/shared/auth-helpers.ts`) provide reusable functions for extracting and validating user identity in API routes.

---

## Key Components

### Dashboard Components

| Component               | File                                              | Description                                                    |
|--------------------------|---------------------------------------------------|----------------------------------------------------------------|
| `DashboardLayoutClient` | `app/dashboard/components/DashboardLayoutClient.tsx` | Main layout with collapsible sidebar and responsive navigation |
| `LiveCallNotifier`      | `app/dashboard/components/LiveCallNotifier.tsx`     | Polls every 5s for active calls; plays ringtone; shows "Join Now" |
| `DoctorProfileModal`    | `app/dashboard/components/DoctorProfileModal.tsx`   | Full doctor profile view for browsing and booking              |
| `PaymentStatusBadge`    | `app/dashboard/components/PaymentStatusBadge.tsx`   | Visual payment status indicator                                |
| `Sidebar`               | `app/dashboard/components/Sidebar.tsx`              | Navigation sidebar with links to all sections                  |
| `DashboardNav`          | `app/dashboard/components/DashboardNav.tsx`         | Top navigation bar                                             |
| `ProfileEditModal`      | `app/dashboard/components/ProfileEditModal.tsx`     | Modal form for editing patient profile                         |

### Shared Components

| Component                  | File                                              | Description                                          |
|----------------------------|---------------------------------------------------|------------------------------------------------------|
| `DailyMedicinePopup`      | `app/components/DailyMedicinePopup.tsx`             | Daily reminder popup for pending medications         |
| `LanguageSwitcher`         | `app/components/LanguageSwitcher.tsx`                | Dropdown to switch between 14 supported languages    |
| `AdherenceCheckbox`       | `app/components/AdherenceCheckbox.tsx`               | Toggle for marking doses as taken or skipped         |
| `DashboardAdherenceWidget`| `app/components/DashboardAdherenceWidget.tsx`        | Recharts-based adherence visualization widget        |
| `TranslatedText`          | `app/components/TranslatedText.tsx`                  | Dynamically translated text component                |
| `PrescriptionNotification`| `app/components/PrescriptionNotification.tsx`        | Alert component for new prescriptions                |
| `ProfilePicture`          | `app/components/ProfilePicture.tsx`                  | Profile image display and upload component           |

### Root Components

| Component                  | File                                        | Description                                      |
|----------------------------|---------------------------------------------|--------------------------------------------------|
| `PatientProfileCheck`     | `components/PatientProfileCheck.tsx`          | Checks profile completeness on login             |
| `ProfileCompletionBanner` | `components/ProfileCompletionBanner.tsx`      | Banner prompting users to complete their profile |
| `ProfileCompletionModal`  | `components/ProfileCompletionModal.tsx`       | Modal wizard for completing profile fields       |

### Custom Hooks

| Hook              | File                               | Description                                          |
|-------------------|------------------------------------|------------------------------------------------------|
| `useTranslation`  | `app/hooks/useTranslation.ts`      | Translation hook with in-memory caching via Lingo.dev |
| `useVoiceToText`  | `app/hooks/useVoiceToText.ts`      | Web Speech API integration for voice-to-text input   |

---

## Internationalization

The portal supports **14 languages** through the Lingo.dev translation SDK.

**Architecture:**

- `LanguageContext` (React Context) stores the selected language globally.
- `useTranslation` hook provides a `t()` function that translates strings on demand with caching.
- `TranslatedText` component wraps any text content for automatic translation.
- `LanguageSwitcher` component renders a dropdown for language selection.
- Static translations are cached client-side; dynamic content is translated via the `/api/translate` endpoint.
- Multi-language greetings are provided by `lib/shared/greetings.ts`.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- A **PostgreSQL** database (Neon recommended)
- **Kinde** account with Google OAuth configured
- **Razorpay** merchant account
- **ZegoCloud** account for video calls
- **Nhost** project for file storage
- **Resend** account for transactional emails
- **Lingo.dev** API key for translations

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd patient_view
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up the database:**

   Execute the SQL files in order against your PostgreSQL instance:

   ```bash
   psql -f Project_DB.sql
   psql -f complete_tables.sql
   psql -f Project_DB_Functions.sql
   ```

4. **Configure environment variables:**

   Create a `.env.local` file in the project root (see [Environment Variables](#environment-variables) below).

5. **Start the development server:**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`.

---

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# ---------------------------------------------------------
# Database (Neon PostgreSQL)
# ---------------------------------------------------------
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# ---------------------------------------------------------
# Kinde Authentication
# ---------------------------------------------------------
KINDE_CLIENT_ID=your_kinde_client_id
KINDE_CLIENT_SECRET=your_kinde_client_secret
KINDE_ISSUER_URL=https://your-app.kinde.com
KINDE_SITE_URL=http://localhost:3000
KINDE_POST_LOGOUT_REDIRECT_URL=http://localhost:3000
KINDE_POST_LOGIN_REDIRECT_URL=http://localhost:3000/api/auth/callback

# ---------------------------------------------------------
# Razorpay Payment Gateway
# ---------------------------------------------------------
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# ---------------------------------------------------------
# ZegoCloud Video Calls
# ---------------------------------------------------------
NEXT_PUBLIC_ZEGO_APP_ID=your_zego_app_id
NEXT_PUBLIC_ZEGO_SERVER_SECRET=your_zego_server_secret

# ---------------------------------------------------------
# Nhost File Storage
# ---------------------------------------------------------
NEXT_PUBLIC_NHOST_SUBDOMAIN=your_nhost_subdomain
NEXT_PUBLIC_NHOST_REGION=your_nhost_region

# ---------------------------------------------------------
# Resend Email API
# ---------------------------------------------------------
RESEND_API_KEY=re_your_resend_api_key
SENDER_EMAIL=your_verified@domain.com

# ---------------------------------------------------------
# Lingo.dev Translation
# ---------------------------------------------------------
LINGODOTDEV_API_KEY=your_lingodotdev_api_key

# ---------------------------------------------------------
# Application
# ---------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note:** Never commit `.env.local` to version control. The `.gitignore` file should already exclude it.

---

## Scripts

| Command          | Description                                 |
|------------------|---------------------------------------------|
| `npm run dev`    | Start the development server on port 3000   |
| `npm run build`  | Create an optimized production build         |
| `npm run start`  | Start the production server                  |
| `npm run lint`   | Run ESLint to check for code quality issues  |

---

## Deployment

### Vercel (Recommended)

The project includes a `vercel.json` configuration file and is ready for deployment on Vercel.

1. Connect your repository to Vercel.
2. Set all environment variables in the Vercel dashboard (Settings > Environment Variables).
3. Deploy. Vercel will automatically detect the Next.js framework and apply the correct build settings.

**Vercel Configuration (`vercel.json`):**

```json
{
    "buildCommand": "npm run build",
    "outputDirectory": ".next",
    "installCommand": "npm install",
    "framework": "nextjs"
}
```

### Image Domains

The following remote image domains are configured in `next.config.js`:

- `lh3.googleusercontent.com` -- Google profile pictures
- `avatars.githubusercontent.com` -- GitHub avatars
- `ynwkhelqhehjlxlhhjfj.storage.ap-south-1.nhost.run` -- Nhost storage

---

## Configuration Details

### Tailwind CSS Theme

The application uses a custom Tailwind CSS theme with healthcare-specific color tokens:

| Token                      | Color     | Usage                           |
|----------------------------|-----------|---------------------------------|
| `primary`                  | `#10B981` | Primary brand green             |
| `secondary`                | `#34D399` | Secondary accent green          |
| `health.primary`           | `#10B981` | Health-related primary actions   |
| `health.secondary`         | `#F59E0B` | Warnings, alerts                |
| `health.accent`            | `#3B82F6` | Informational accents           |
| `appointment.confirmed`    | `#10B981` | Confirmed appointment status    |
| `appointment.pending`      | `#EAB308` | Pending appointment status      |
| `appointment.cancelled`    | `#EF4444` | Cancelled appointment status    |
| `appointment.completed`    | `#3B82F6` | Completed appointment status    |

**Fonts:** Poppins (primary), Noto Sans Devanagari (Hindi/Devanagari support)

### Database Connection

The PostgreSQL connection (`lib/db.ts`) is configured with:

- SSL enabled (`rejectUnauthorized: false` for Neon compatibility)
- Connection pool: max 10 connections
- Idle timeout: 20 seconds
- Connect timeout: 10 seconds

---

## Related Services

AuraSutra is a multi-service platform. This Patient Portal communicates with:

- **Doctor Portal** -- Separate application for doctor-side operations (managing appointments, issuing prescriptions, initiating video calls)
- **Shared Library** (`lib/shared/`) -- Common types, utilities, and notification templates shared across services

---

*AuraSutra Ayurvedic Healthcare Platform -- Patient Portal v1.0.0*
