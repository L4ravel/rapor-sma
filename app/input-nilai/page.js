"use client";

import Link from "next/link";

export default function InputNilaiHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">
            📝 Input Nilai Siswa
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/input-nilai/umum"
              className="block rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 p-6 shadow-lg hover:shadow-xl transition"
            >
              <div className="text-center text-white">
                <div className="text-5xl mb-2">📘</div>
                <div className="text-xl font-bold">Mapel Umum</div>
                <p className="opacity-90 mt-1 text-sm">
                  Input nilai & capaian mapel umum. Absensi ikut tersinkron.
                </p>
              </div>
            </Link>

            <Link
              href="/input-nilai/pondok"
              className="block rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-6 shadow-lg hover:shadow-xl transition"
            >
              <div className="text-center text-white">
                <div className="text-5xl mb-2">📗</div>
                <div className="text-xl font-bold">Mapel Pondok</div>
                <p className="opacity-90 mt-1 text-sm">
                  Input nilai mapel pondok. Absensi ikut tersinkron.
                </p>
              </div>
            </Link>
          </div>

          <p className="text-center text-gray-600 text-xs mt-8">
            Tip: gunakan header <b>Daftar Kelas</b> untuk memfilter kelas.
          </p>
        </div>
      </div>
    </div>
  );
}
