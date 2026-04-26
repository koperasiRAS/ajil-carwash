# Sistem Car Wash — Final Report

## Halaman yang sudah ada:
1. `/login` - Halaman Login (Owner & Kasir)
2. `/dashboard` - Dashboard Utama Owner (Statistik Realtime)
3. `/kasir` - Halaman Transaksi Kasir (POS Desktop, Tablet, Mobile)
4. `/shift` - Halaman Buka/Tutup Shift (Manajemen Kasir)
5. `/transactions` - Riwayat Transaksi (Owner)
6. `/reports` - Laporan Keuangan Harian/Mingguan & Export (Owner)
7. `/services` - Manajemen Layanan & Harga (Owner)
8. `/employees` - Manajemen Karyawan & PIN (Owner)
9. `/shifts` - Riwayat Shift & Cash Opname (Owner)
10. `/stock` - Manajemen Stok Barang & Logs (Owner)
11. `/expenses` - Manajemen Pengeluaran Shift (Owner)
12. `/audit-logs` - Log Aktivitas Karyawan & Sistem (Owner)
13. `/settings` - Pengaturan Sistem (Owner)

## Fitur anti-manipulasi yang diimplementasikan:
1. **Pemisahan Role yang Ketat:** Kasir hanya bisa mengakses halaman `/kasir` dan `/shift`. Akses ke dashboard atau laporan otomatis di-redirect/ditolak.
2. **Validasi Buka/Tutup Shift:** Kasir diwajibkan melakukan pencatatan kas awal sebelum transaksi, dan kas akhir (termasuk selisih) setelah selesai. Kasir tidak bisa memiliki 2 shift aktif bersamaan.
3. **Pencegahan Perubahan Data Kasir:** Kasir **tidak bisa** merubah harga layanan yang sudah ditetapkan owner.
4. **Pembatasan Void (Pembatalan):** Kasir tidak dapat menghapus atau membatalkan (void) transaksi secara mandiri. Hanya owner yang memiliki hak untuk mem-void transaksi.
5. **Pencatatan Audit (Audit Trail):** Setiap perubahan kritis seperti login, pembatalan transaksi, perubahan harga, dan selisih kas dicatat secara permanen di Audit Log yang tidak bisa dihapus oleh kasir.
6. **Integritas Transaksi:** Pembayaran yang nominalnya kurang dari total transaksi tidak dapat diproses. Transaksi yang void tidak dimasukkan ke dalam perhitungan omzet di laporan.
7. **Keamanan URL/API:** Endpoint API memverifikasi status token dan mencocokkan role untuk mencegah _API hijacking_ dari kasir nakal.

## Hal yang perlu dikembangkan ke depan:
- Notifikasi WA otomatis (Twilio/WA Business API)
- Aplikasi mobile (React Native)
- Multi-outlet support
- Backup otomatis terjadwal
- Integrasi printer thermal bluetooth
- Integrasi Payment Gateway (QRIS Dinamis)

## Estimasi waktu pengerjaan:
**Total Pengerjaan:** 7 - 10 Hari Kerja.
Pengerjaan telah mencakup: 
1. Setup Database & Auth (Supabase)
2. Backend API & ORM (Prisma)
3. Frontend UI & Responsive Layout (Tailwind & Shadcn UI)
4. Finalisasi Testing & Bug Fixing (Zero TS Error)
