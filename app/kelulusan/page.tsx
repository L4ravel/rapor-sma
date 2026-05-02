/* Halaman menu utama kelulusan dengan tiga tombol aksi utama yang konsisten dan profesional. */

"use client";

import Link from "next/link";

/* ---------- UI helper ---------- */
function MenuCard({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
          {badge}
        </div>

        <h2 className="mt-4 text-xl font-black tracking-tight text-slate-900 md:text-2xl">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          {description}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors duration-300 group-hover:bg-blue-600">
          Buka Menu
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function KelulusanPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
              Kelulusan
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
              Menu Utama Kelulusan
            </h1>
          
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <MenuCard
                href="/kelulusan/tambah-program-jurusan"
                badge="Langkah 1"
                title="Tambah Program Jurusan"
                description="Buat daftar program jurusan terlebih dahulu agar struktur data kelulusan siap dipakai pada langkah berikutnya."
              />

              <MenuCard
                href="/kelulusan/tambah-siswa"
                badge="Langkah 2"
                title="Tambah Siswa"
                description="Masukkan data siswa kelulusan yang akan diproses, lalu hubungkan dengan program jurusan yang sudah kamu siapkan sebelumnya."
              />

              <MenuCard
                href="/kelulusan/masukkan-nilai"
                badge="Langkah 3"
                title="Masukkan Nilai"
                description="Input nilai siswa berdasarkan data yang sudah tersusun agar proses pengolahan kelulusan lebih mudah dan tetap konsisten."
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}