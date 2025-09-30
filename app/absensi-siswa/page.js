"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export default function AbsensiSiswaPage() {
  const [data, setData] = useState([]);
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ambil siswa + rapor (absensi + catatan_wali)
  const fetchData = async (withSpinner = true) => {
    try {
      if (withSpinner) setLoading(true);

      const siswaSnap = await getDocs(collection(db, "siswa"));
      const siswa = siswaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // kelas unik
      const kelasUnik = [...new Set(siswa.map((s) => s.kelas).filter(Boolean))];
      setDaftarKelas(kelasUnik);

      // rapor
      const rapSnap = await getDocs(collection(db, "raport"));
      const rap = Object.fromEntries(rapSnap.docs.map((d) => [d.id, d.data()]));

      // gabungkan
      const merged = siswa.map((s) => {
        const r = rap[s.nisn] || {};
        return {
          ...s,
          sakit: r.sakit ?? "",
          izin: r.izin ?? "",
          alpha: r.alpha ?? "",
          catatan_wali: r.catatan_wali ?? "",
        };
      });

      setData(merged);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal mengambil data absensi");
    } finally {
      if (withSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  // Filter per kelas, urutkan alfabetis, & batasi 50 data
  const filtered = data
    .filter((r) => (selectedKelas ? r.kelas === selectedKelas : true))
    .sort((a, b) => (a.nama_siswa || "").localeCompare(b.nama_siswa || ""));
  const visible = filtered.slice(0, 50);

  // Simpan semua (termasuk catatan_wali)
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      for (const row of filtered) {
        const ref = doc(collection(db, "raport"), String(row.nisn));
        await setDoc(
          ref,
          {
            nisn: row.nisn,
            nama_siswa: row.nama_siswa,
            kelas: row.kelas,
            sakit: row.sakit ?? "",
            izin: row.izin ?? "",
            alpha: row.alpha ?? "",
            catatan_wali: row.catatan_wali ?? "",
          },
          { merge: true }
        );
      }
      alert("✅ Absensi & Catatan wali berhasil disimpan!");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 md:p-10">
      <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-black">
            🗓️ Absensi Siswa
          </h1>
          <div className="flex items-center gap-3">
            <Link href="/input-nilai" className="text-black hover:underline text-sm">
              ← Kembali ke Input Nilai
            </Link>
          </div>
        </div>

        {/* Konten */}
        {loading ? (
          <p className="text-center text-black">⏳ Memuat data...</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-300/50 shadow-md">
            <table className="w-full text-sm overflow-hidden rounded-2xl border border-gray-300/50">
              <thead className="sticky top-0 z-10">
                {/* Baris 1 */}
                <tr className="bg-gradient-to-r from-sky-200 to-indigo-200 text-black text-xs">
                  <th rowSpan={2} className="p-1 w-2 border border-gray-300/50 text-center">No</th>
                  <th rowSpan={2} className="p-1 w-4 border border-gray-300/50 text-center">NISN</th>
                  <th rowSpan={2} className="p-1 w-8 border border-gray-300/50 text-center">Nama</th>
                  <th className="p-2 w-24 border border-gray-300/50 text-center">Daftar Kelas</th>
                  <th colSpan={3} className="p-2 border border-gray-300/50 text-center">Absensi</th>
                  {/* Header Catatan diperkecil */}
                  <th
  rowSpan={2}
  className="p-1 w-[10rem] md:w-[12rem] lg:w-[14rem] border border-gray-300/50 text-center text-[10px] whitespace-normal break-words"
>
  Catatan Wali Kelas
</th>
                </tr>

                {/* Baris 2 */}
                <tr className="bg-gradient-to-r from-sky-100 to-indigo-100 text-black text-xs">
                  {/* Filter kelas */}
                  <th className="p-2 w-24 border border-gray-300/50 text-center">
                    <select
                      value={selectedKelas}
                      onChange={(e) => setSelectedKelas(e.target.value)}
                      className="w-full rounded-md bg-white text-black px-2 py-1 text-xs focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="">Semua</option>
                      {daftarKelas.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </th>

                  <th className="p-2 w-12 border border-gray-300/50 text-center">S</th>
                  <th className="p-2 w-12 border border-gray-300/50 text-center">I</th>
                  <th className="p-2 w-12 border border-gray-300/50 text-center">A</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`transition hover:bg-sky-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="p-1 text-center border border-gray-300/50 text-black">{idx + 1}</td>
                    <td className="p-1 text-center border border-gray-300/50 text-black truncate" title={row.nisn}>
                      {row.nisn}
                    </td>
                    <td className="p-1 border border-gray-300/50 text-black truncate" title={row.nama_siswa}>
                      {row.nama_siswa}
                    </td>

                    {/* Kelas (read-only) */}
                    <td className="p-2 text-center border border-gray-300/50 text-black">{row.kelas}</td>

                    {/* Absensi */}
                    {["sakit", "izin", "alpha"].map((field) => (
                      <td key={field} className="p-2 w-12 text-center border border-gray-300/50 align-top">
                        <input
  type="number"
  min={0}
  value={row[field] ?? ""}
  onChange={(e) =>
    setData((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, [field]: e.target.value } : r
      )
    )
  }
  className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
/>
                      </td>
                    ))}

                    {/* Catatan Wali Kelas */}
                    <td className="p-2 border border-gray-300/50 align-top">
                      <textarea
                        rows={2}
                        value={row.catatan_wali ?? ""}
                        onChange={(e) =>
                          setData((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, catatan_wali: e.target.value } : r
                            )
                          )
                        }
                        className="w-full border rounded-md px-3 py-2 text-xs text-black focus:ring-2 focus:ring-indigo-400 resize-y"
                        placeholder="Catatan singkat perkembangan/karakter, saran, dsb."
                      />
                    </td>
                  </tr>
                ))}

                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center p-4 text-gray-500">
                      Tidak ada data untuk filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Aksi */}
        <div className="mt-6 flex items-center justify-end">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 disabled:opacity-50 text-white px-6 py-2 rounded-full shadow-lg hover:from-green-600 hover:to-teal-600 transition text-sm font-semibold"
          >
            {saving ? "💾 Menyimpan..." : "💾 Simpan Semua"}
          </button>
        </div>
      </div>
    </div>
  );
}
