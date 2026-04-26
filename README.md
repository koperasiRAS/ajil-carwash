# Sistem Manajemen Car Wash

Aplikasi manajemen car wash berbasis web dengan fitur anti-manipulasi karyawan.

## Fitur Utama
- Kasir digital (POS) anti-manipulasi
- Dashboard owner real-time
- Manajemen shift karyawan
- Laporan keuangan lengkap
- Audit log permanen
- Export PDF & Excel

## Tech Stack
- Next.js 16 + TypeScript
- Supabase (PostgreSQL + Auth + Realtime)
- Prisma ORM
- Tailwind CSS v4 + Shadcn/UI

## Setup

1. Clone repository
2. `cp .env.local.example .env.local`
3. Isi semua environment variables
4. `npm install`
5. `npx prisma generate`
6. `npx prisma db push`
7. `npx ts-node prisma/seed.ts`
8. `npm run dev`

## Default Login
Owner: owner@carwash.com / Owner123!
Kasir: kasir1@carwash.com / Kasir123!

## Deployment
Deploy ke Vercel + Supabase Cloud.