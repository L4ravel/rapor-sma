<<<<<<< HEAD
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
      const kelasUnik = [
        ...new Set(siswa.map((s) => s.kelas).filter(Boolean)),
      ];
      setDaftarKelas(kelasUnik);

      // rapor
      const rapSnap = await getDocs(collection(db, "raport"));
      const rap = Object.fromEntries(
        rapSnap.docs.map((d) => [d.id, d.data()])
      );

      // gabungkan
      const merged = siswa.map((s) => {
        const r = rap[s.nisn] || {};
        return {
          ...s,
          sakit: r.sakit ?? "",
          izin: r.izin ?? "",
          alpha: r.alpha ?? "",
          catatan_wali: r.catatan_wali ?? "",
          // field poin rapor
          poin: r.poin ?? "",
          // field lock rapor
          locked: r.locked ?? false,
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

  // Jika belum ada kelas terpilih, pilih otomatis kelas pertama
  useEffect(() => {
    if (!selectedKelas && daftarKelas.length > 0) {
      setSelectedKelas(daftarKelas[0]);
    }
  }, [daftarKelas, selectedKelas]);

  // Filter per kelas, urutkan alfabetis, & batasi 50 data
  const filtered = data
    .filter((r) => (!selectedKelas ? false : r.kelas === selectedKelas))
    .sort((a, b) => (a.nama_siswa || "").localeCompare(b.nama_siswa || ""));
  const visible = filtered.slice(0, 50);

  // Simpan semua (termasuk catatan_wali, poin & locked) untuk kelas yang sedang dipilih
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
            poin: row.poin ?? "",
            // simpan status lock rapor
            locked: row.locked ?? false,
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-black">
              🗓️ Absensi Siswa
            </h1>
            <p className="text-xs md:text-sm text-slate-600 mt-1">
              Input kehadiran dan catatan wali kelas per rombel.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/input-nilai"
              className="text-black hover:underline text-sm"
            >
              ← Kembali ke Input Nilai
            </Link>
          </div>
        </div>

        {/* FILTER & INFO KELAS (di atas semua tampilan) */}
        <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Select kelas */}
          <div className="w-full md:w-64">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kelas aktif
            </label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full rounded-lg bg-white text-black px-3 py-2 text-sm border border-slate-300 shadow-sm focus:ring-2 focus:ring-sky-400"
            >
              {daftarKelas.length === 0 ? (
                <option value="">Belum ada kelas</option>
              ) : (
                daftarKelas.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Konten */}
        {loading ? (
          <p className="text-center text-black">⏳ Memuat data...</p>
        ) : (
          <>
            {/* ====== MOBILE LAYOUT (CARD PER SISWA) ====== */}
            <div className="md:hidden space-y-3">
              {visible.map((row, idx) => (
                <div
                  key={row.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3"
                >
                  {/* 1. Yuliana (nomor + nama, tanpa NISN) */}
                  <div className="mb-2">
                    <div className="text-sm font-bold text-slate-900 leading-snug">
                      {idx + 1}. {row.nama_siswa}
                    </div>
                  </div>

                  {/* Kolom absensi: S, I, A, Poin */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {["sakit", "izin", "alpha"].map((field) => {
                      const label =
                        field === "sakit"
                          ? "Sakit"
                          : field === "izin"
                          ? "Izin"
                          : "Alpha";
                      return (
                        <div key={field} className="flex flex-col">
                          <span className="text-[10px] text-slate-500 mb-1 text-center">
                            {label}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={row[field] ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, [field]: e.target.value }
                                    : r
                                )
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full border rounded-lg px-2 py-1.5 text-xs text-center text-slate-900 focus:ring-2 focus:ring-sky-400"
                          />
                        </div>
                      );
                    })}

                    {/* Poin */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 mb-1 text-center">
                        Poin
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={row.poin ?? ""}
                        onChange={(e) =>
                          setData((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, poin: e.target.value } : r
                            )
                          )
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs text-center text-slate-900 focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>

                  {/* Catatan wali kelas (lebih tinggi) */}
                  <div className="mt-1">
                    <div className="text-[10px] text-slate-500 mb-1">
                      Catatan Wali Kelas
                    </div>
                    <textarea
                      rows={3}
                      value={row.catatan_wali ?? ""}
                      onChange={(e) =>
                        setData((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, catatan_wali: e.target.value } : r
                          )
                        )
                      }
                      className="w-full border rounded-lg px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-400 resize-y min-h-[80px]"
                      placeholder="Catatan singkat perkembangan, karakter, atau saran untuk orang tua."
                    />
                  </div>

                  {/* Tombol Lock Rapor */}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setData((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, locked: !r.locked } : r))
                        )
                      }
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold border transition ${
                        row.locked ? "bg-red-100 text-red-700 border-red-300" : "bg-emerald-100 text-emerald-700 border-emerald-300"
                      }`}
                    >
                      <span>{row.locked ? "🔒 Terkunci" : "🔓 Terbuka"}</span>
                    </button>
                  </div>
                </div>
              ))}

              {visible.length === 0 && (
                <p className="text-center text-xs text-slate-500">
                  Tidak ada data untuk kelas ini.
                </p>
              )}
            </div>

            {/* ====== DESKTOP TABLE LAYOUT ====== */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-300/50 shadow-md">
              <table className="w-full text-sm overflow-hidden rounded-2xl border border-gray-300/50">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-sky-200 to-indigo-200 text-black text-xs">
                    <th className="p-1 w-2 border border-gray-300/50 text-center">
                      No
                    </th>
                    <th className="p-1 w-4 border border-gray-300/50 text-center">
                      NISN
                    </th>
                    <th className="p-1 w-8 border border-gray-300/50 text-center">
                      Nama
                    </th>
                    <th className="p-2 w-24 border border-gray-300/50 text-center">
                      Kelas
                    </th>
                    <th className="p-2 w-12 border border-gray-300/50 text-center">
                      S
                    </th>
                    <th className="p-2 w-12 border border-gray-300/50 text-center">
                      I
                    </th>
                    <th className="p-2 w-12 border border-gray-300/50 text-center">
                      A
                    </th>
                    <th className="p-1 w-[12rem] lg:w-[14rem] border border-gray-300/50 text-center text-[10px] whitespace-normal break-words">
                      Catatan Wali Kelas
                    </th>
                    {/* Kolom Poin */}
                    <th className="p-2 w-12 border border-gray-300/50 text-center text-[10px]">
                      Poin
                    </th>
                    {/* Kolom Lock */}
                    <th className="p-2 w-16 border border-gray-300/50 text-center text-[10px]">
                      Lock
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`transition hover:bg-sky-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="p-1 text-center border border-gray-300/50 text-black">
                        {idx + 1}
                      </td>
                      <td
                        className="p-1 text-center border border-gray-300/50 text-black truncate"
                        title={row.nisn}
                      >
                        {row.nisn}
                      </td>
                      <td
                        className="p-1 border border-gray-300/50 text-black truncate"
                        title={row.nama_siswa}
                      >
                        {row.nama_siswa}
                      </td>
                      <td className="p-2 text-center border border-gray-300/50 text-black">
                        {row.kelas}
                      </td>

                      {["sakit", "izin", "alpha"].map((field) => (
                        <td key={field} className="p-2 w-12 text-center border border-gray-300/50 align-top">
                          <input
                            type="number"
                            min={0}
                            value={row[field] ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, [field]: e.target.value } : r))
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                          />
                        </td>
                      ))}

                      <td className="p-2 border border-gray-300/50 align-top">
                        <textarea
                          rows={2}
                          value={row.catatan_wali ?? ""}
                          onChange={(e) =>
                            setData((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, catatan_wali: e.target.value } : r))
                            )
                          }
                          className="w-full border rounded-md px-3 py-2 text-xs text-black focus:ring-2 focus:ring-indigo-400 resize-y"
                          placeholder="Catatan singkat perkembangan, karakter, atau saran untuk orang tua."
                        />
                      </td>

                      {/* Kolom Poin */}
                      <td className="p-2 w-12 text-center border border-gray-300/50 align-top">
                        <input
                          type="number"
                          min={0}
                          value={row.poin ?? ""}
                          onChange={(e) =>
                            setData((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, poin: e.target.value } : r))
                            )
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                        />
                      </td>

                      {/* Tombol Lock Rapor */}
                      <td className="p-2 text-center border border-gray-300/50 align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            setData((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, locked: !r.locked } : r))
                            )
                          }
                          className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold border transition ${
                            row.locked ? "bg-red-100 text-red-700 border-red-300" : "bg-emerald-100 text-emerald-700 border-emerald-300"
                          }`}
                        >
                          {row.locked ? "🔒 Terkunci" : "🔓 Terbuka"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center p-4 text-gray-500">
                        Tidak ada data untuk kelas ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
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
=======
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
      const kelasUnik = [
        ...new Set(siswa.map((s) => s.kelas).filter(Boolean)),
      ];
      setDaftarKelas(kelasUnik);

      // rapor
      const rapSnap = await getDocs(collection(db, "raport"));
      const rap = Object.fromEntries(
        rapSnap.docs.map((d) => [d.id, d.data()])
      );

      // gabungkan
      const merged = siswa.map((s) => {
        const r = rap[s.nisn] || {};
        return {
          ...s,
          sakit: r.sakit ?? "",
          izin: r.izin ?? "",
          alpha: r.alpha ?? "",
          catatan_wali: r.catatan_wali ?? "",
          // field poin rapor
          poin: r.poin ?? "",
          // field lock rapor
          locked: r.locked ?? false,
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

  // Jika belum ada kelas terpilih, pilih otomatis kelas pertama
  useEffect(() => {
    if (!selectedKelas && daftarKelas.length > 0) {
      setSelectedKelas(daftarKelas[0]);
    }
  }, [daftarKelas, selectedKelas]);

  // Filter per kelas, urutkan alfabetis, & batasi 50 data
  const filtered = data
    .filter((r) => (!selectedKelas ? false : r.kelas === selectedKelas))
    .sort((a, b) => (a.nama_siswa || "").localeCompare(b.nama_siswa || ""));
  const visible = filtered.slice(0, 50);

  // Simpan semua (termasuk catatan_wali, poin & locked) untuk kelas yang sedang dipilih
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
            poin: row.poin ?? "",
            // simpan status lock rapor
            locked: row.locked ?? false,
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-black">
              🗓️ Absensi Siswa
            </h1>
            <p className="text-xs md:text-sm text-slate-600 mt-1">
              Input kehadiran dan catatan wali kelas per rombel.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/input-nilai"
              className="text-black hover:underline text-sm"
            >
              ← Kembali ke Input Nilai
            </Link>
          </div>
        </div>

        {/* FILTER & INFO KELAS (di atas semua tampilan) */}
        <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Select kelas */}
          <div className="w-full md:w-64">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kelas aktif
            </label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="w-full rounded-lg bg-white text-black px-3 py-2 text-sm border border-slate-300 shadow-sm focus:ring-2 focus:ring-sky-400"
            >
              {daftarKelas.length === 0 ? (
                <option value="">Belum ada kelas</option>
              ) : (
                daftarKelas.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Konten */}
        {loading ? (
          <p className="text-center text-black">⏳ Memuat data...</p>
        ) : (
          <>
            {/* ====== MOBILE LAYOUT (CARD PER SISWA) ====== */}
            <div className="md:hidden space-y-3">
              {visible.map((row, idx) => (
                <div
                  key={row.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3"
                >
                  {/* 1. Yuliana (nomor + nama, tanpa NISN) */}
                  <div className="mb-2">
                    <div className="text-sm font-bold text-slate-900 leading-snug">
                      {idx + 1}. {row.nama_siswa}
                    </div>
                  </div>

                  {/* Kolom absensi: S, I, A, Poin */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {["sakit", "izin", "alpha"].map((field) => {
                      const label =
                        field === "sakit"
                          ? "Sakit"
                          : field === "izin"
                          ? "Izin"
                          : "Alpha";
                      return (
                        <div key={field} className="flex flex-col">
                          <span className="text-[10px] text-slate-500 mb-1 text-center">
                            {label}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={row[field] ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, [field]: e.target.value }
                                    : r
                                )
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full border rounded-lg px-2 py-1.5 text-xs text-center text-slate-900 focus:ring-2 focus:ring-sky-400"
                          />
                        </div>
                      );
                    })}

                    {/* Poin */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 mb-1 text-center">
                        Poin
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={row.poin ?? ""}
                        onChange={(e) =>
                          setData((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, poin: e.target.value } : r
                            )
                          )
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full border rounded-lg px-2 py-1.5 text-xs text-center text-slate-900 focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>

                  {/* Catatan wali kelas (lebih tinggi) */}
                  <div className="mt-1">
                    <div className="text-[10px] text-slate-500 mb-1">
                      Catatan Wali Kelas
                    </div>
                    <textarea
                      rows={3}
                      value={row.catatan_wali ?? ""}
                      onChange={(e) =>
                        setData((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, catatan_wali: e.target.value } : r
                          )
                        )
                      }
                      className="w-full border rounded-lg px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-400 resize-y min-h-[80px]"
                      placeholder="Catatan singkat perkembangan, karakter, atau saran untuk orang tua."
                    />
                  </div>

                  {/* Tombol Lock Rapor */}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setData((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, locked: !r.locked } : r))
                        )
                      }
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold border transition ${
                        row.locked ? "bg-red-100 text-red-700 border-red-300" : "bg-emerald-100 text-emerald-700 border-emerald-300"
                      }`}
                    >
                      <span>{row.locked ? "🔒 Terkunci" : "🔓 Terbuka"}</span>
                    </button>
                  </div>
                </div>
              ))}

              {visible.length === 0 && (
                <p className="text-center text-xs text-slate-500">
                  Tidak ada data untuk kelas ini.
                </p>
              )}
            </div>

            {/* ====== DESKTOP TABLE LAYOUT ====== */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-300/50 shadow-md">
              <table className="w-full text-sm overflow-hidden rounded-2xl border border-gray-300/50">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-sky-200 to-indigo-200 text-black text-xs">
                    <th className="p-1 w-2 border border-gray-300/50 text-center">
                      No
                    </th>
                    <th className="p-1 w-4 border border-gray-300/50 text-center">
                      NISN
                    </th>
                    <th className="p-1 w-8 border border-gray-300/50 text-center">
                      Nama
                    </th>
                    <th className="p-2 w-24 border border-gray-300/50 text-center">
                      Kelas
                    </th>
                    <th className="p-2 w-12 border border-gray-300/50 text-center">
                      S
                    </th>
                    <th className="p-2 w-12 border border-gray-300/50 text-center">
                      I
                    </th>
                    <th className="p-2 w-12 border border-gray-300/50 text-center">
                      A
                    </th>
                    <th className="p-1 w-[12rem] lg:w-[14rem] border border-gray-300/50 text-center text-[10px] whitespace-normal break-words">
                      Catatan Wali Kelas
                    </th>
                    {/* Kolom Poin */}
                    <th className="p-2 w-12 border border-gray-300/50 text-center text-[10px]">
                      Poin
                    </th>
                    {/* Kolom Lock */}
                    <th className="p-2 w-16 border border-gray-300/50 text-center text-[10px]">
                      Lock
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visible.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`transition hover:bg-sky-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="p-1 text-center border border-gray-300/50 text-black">
                        {idx + 1}
                      </td>
                      <td
                        className="p-1 text-center border border-gray-300/50 text-black truncate"
                        title={row.nisn}
                      >
                        {row.nisn}
                      </td>
                      <td
                        className="p-1 border border-gray-300/50 text-black truncate"
                        title={row.nama_siswa}
                      >
                        {row.nama_siswa}
                      </td>
                      <td className="p-2 text-center border border-gray-300/50 text-black">
                        {row.kelas}
                      </td>

                      {["sakit", "izin", "alpha"].map((field) => (
                        <td key={field} className="p-2 w-12 text-center border border-gray-300/50 align-top">
                          <input
                            type="number"
                            min={0}
                            value={row[field] ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, [field]: e.target.value } : r))
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                          />
                        </td>
                      ))}

                      <td className="p-2 border border-gray-300/50 align-top">
                        <textarea
                          rows={2}
                          value={row.catatan_wali ?? ""}
                          onChange={(e) =>
                            setData((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, catatan_wali: e.target.value } : r))
                            )
                          }
                          className="w-full border rounded-md px-3 py-2 text-xs text-black focus:ring-2 focus:ring-indigo-400 resize-y"
                          placeholder="Catatan singkat perkembangan, karakter, atau saran untuk orang tua."
                        />
                      </td>

                      {/* Kolom Poin */}
                      <td className="p-2 w-12 text-center border border-gray-300/50 align-top">
                        <input
                          type="number"
                          min={0}
                          value={row.poin ?? ""}
                          onChange={(e) =>
                            setData((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, poin: e.target.value } : r))
                            )
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                        />
                      </td>

                      {/* Tombol Lock Rapor */}
                      <td className="p-2 text-center border border-gray-300/50 align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            setData((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, locked: !r.locked } : r))
                            )
                          }
                          className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[10px] font-semibold border transition ${
                            row.locked ? "bg-red-100 text-red-700 border-red-300" : "bg-emerald-100 text-emerald-700 border-emerald-300"
                          }`}
                        >
                          {row.locked ? "🔒 Terkunci" : "🔓 Terbuka"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center p-4 text-gray-500">
                        Tidak ada data untuk kelas ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
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
>>>>>>> a4197c0e3e5ac25b8f084d5bb75d699be91c54eb
