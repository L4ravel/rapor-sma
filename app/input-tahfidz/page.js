"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export default function InputTahfidzPage() {
  const [data, setData] = useState([]);
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ambil siswa + rapor (field tahfidz)
  const fetchData = async (withSpinner = true) => {
    try {
      if (withSpinner) setLoading(true);

      const siswaSnap = await getDocs(collection(db, "siswa"));
      const siswa = siswaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const kelasUnik = [
        ...new Set(
          siswa
            .map((s) => (s.kelas || "").toString().trim())
            .filter(Boolean)
        ),
      ].sort((a, b) =>
        a.localeCompare(b, "id", {
          sensitivity: "base",
          numeric: true,
        })
      );

      setDaftarKelas(kelasUnik);
      setSelectedKelas((prev) => prev || kelasUnik[0] || "");

      const rapSnap = await getDocs(collection(db, "raport"));
      const rap = Object.fromEntries(rapSnap.docs.map((d) => [d.id, d.data()]));

      const merged = siswa.map((s) => {
        const r = rap[s.nisn] || {};
        const t = r.tahfidz || {};
        return {
          ...s,
          tahfidz_total_juz: t.total_juz ?? "",
          tahfidz_target_lembar: t.target_lembar ?? "",
          tahfidz_tercapai_lembar: t.tercapai_lembar ?? "",
          tahfidz_keterangan: t.keterangan ?? "",
          tahfidz_nilai: t.nilai ?? "",
        };
      });

      merged.sort((a, b) =>
        String(a.nama_siswa || "").localeCompare(
          String(b.nama_siswa || ""),
          "id",
          {
            sensitivity: "base",
            numeric: false,
          }
        )
      );

      setData(merged);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal mengambil data Tahfidz");
    } finally {
      if (withSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  const filtered = data.filter((r) =>
    selectedKelas ? r.kelas === selectedKelas : false
  );
  const visible = filtered.slice(0, 50);

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
            tahfidz: {
              total_juz: Number(row.tahfidz_total_juz || 0),
              target_lembar: Number(row.tahfidz_target_lembar || 0),
              tercapai_lembar: Number(row.tahfidz_tercapai_lembar || 0),
              keterangan: row.tahfidz_keterangan || "",
              nilai: Number(row.tahfidz_nilai || 0),
            },
          },
          { merge: true }
        );
      }
      alert("✅ Nilai Tahfidz berhasil disimpan!");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan data Tahfidz");
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
            📖 Input Penilaian Hafalan Al-Qur’an
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/input-nilai"
              className="text-black hover:underline text-sm"
            >
              ← Kembali ke Input Nilai
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-black">⏳ Memuat data...</p>
        ) : (
          <>
            {/* DESKTOP / TABLET */}
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-2xl border border-gray-300/50 shadow-md">
                <table className="w-full text-sm table-fixed overflow-hidden rounded-2xl border border-gray-300/50">
                  {/* Atur lebar kolom di sini */}
                  <colgroup>
                    <col className="w-[60px]" />
                    <col className="w-[130px]" />
                    <col className="w-[260px]" />
                    <col className="w-[120px]" />
                    <col className="w-[90px]" />
                    <col className="w-[110px]" />
                    <col className="w-[110px]" />
                    <col className="w-[430px]" />
                    <col className="w-[80px]" />
                  </colgroup>

                  <thead className="sticky top-0 z-10">
                    {/* Baris 1 */}
                    <tr className="bg-gradient.to-r from-sky-200 to-indigo-200 text-black text-xs">
                      <th
                        rowSpan={2}
                        className="p-1 border border-gray-300/50 text-center"
                      >
                        No
                      </th>
                      <th
                        rowSpan={2}
                        className="p-1 border border-gray-300/50 text-center"
                      >
                        NISN
                      </th>
                      <th
                        rowSpan={2}
                        className="p-1 border border-gray-300/50 text-center"
                      >
                        Nama
                      </th>
                      <th className="p-2 border border-gray-300/50 text-center">
                        Daftar Kelas
                      </th>
                      <th
                        colSpan={5}
                        className="p-2 border border-gray-300/50 text-center"
                      >
                        Penilaian Hafalan Al-Qur’an
                      </th>
                    </tr>

                    {/* Baris 2 */}
                    <tr className="bg-gradient.to-r from-sky-100 to-indigo-100 text-black text-xs">
                      <th className="p-2 border border-gray-300/50 text-center">
                        <select
                          value={selectedKelas}
                          onChange={(e) => setSelectedKelas(e.target.value)}
                          className="w-full rounded-md bg-white text-black px-2 py-1 text-xs focus:ring-2 focus:ring-sky-400"
                        >
                          {daftarKelas.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </th>

                      <th className="p-2 border border-gray-300/50 text-center">
                        Total Juz
                      </th>
                      <th className="p-2 border border-gray-300/50 text-center">
                        Target (lembar)
                      </th>
                      <th className="p-2 border border-gray-300/50 text-center">
                        Tercapai (lembar)
                      </th>
                      <th className="p-2 border border-gray-300/50 text-center">
                        Keterangan
                      </th>
                      <th className="p-2 border border-gray-300/50 text-center">
                        Nilai
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visible.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`transition hover:bg-sky-50 ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
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

                        {/* Total Juz */}
                        <td className="p-2 text-center border border-gray-300/50 align-top">
                          <input
                            type="number"
                            min={0}
                            value={row.tahfidz_total_juz ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        tahfidz_total_juz: e.target.value,
                                      }
                                    : r
                                )
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                            placeholder="0"
                          />
                        </td>

                        {/* Target */}
                        <td className="p-2 text-center border border-gray-300/50 align-top">
                          <input
                            type="number"
                            min={0}
                            value={row.tahfidz_target_lembar ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        tahfidz_target_lembar: e.target.value,
                                      }
                                    : r
                                )
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                            placeholder="0"
                          />
                        </td>

                        {/* Tercapai */}
                        <td className="p-2 text-center border border-gray-300/50 align-top">
                          <input
                            type="number"
                            min={0}
                            value={row.tahfidz_tercapai_lembar ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        tahfidz_tercapai_lembar:
                                          e.target.value,
                                      }
                                    : r
                                )
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                            placeholder="0"
                          />
                        </td>

                        {/* Keterangan – kolom besar */}
                        <td className="p-2 border border-gray-300/50 align-top">
                          <textarea
                            rows={2}
                            value={row.tahfidz_keterangan ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        tahfidz_keterangan: e.target.value,
                                      }
                                    : r
                                )
                              )
                            }
                            className="w-full border rounded-md px-3 py-2 text-xs text-black focus:ring-2 focus:ring-indigo-400 resize-y"
                            placeholder="Contoh: Lancar juz 2 dan setoran rutin"
                          />
                        </td>

                        {/* Nilai */}
                        <td className="p-2 text-center border border-gray-300/50 align-top">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={row.tahfidz_nilai ?? ""}
                            onChange={(e) =>
                              setData((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        tahfidz_nilai: e.target.value,
                                      }
                                    : r
                                )
                              )
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full h-[52px] border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-sky-400"
                            placeholder="0-100"
                          />
                        </td>
                      </tr>
                    ))}

                    {visible.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center p-4 text-gray-500"
                        >
                          Tidak ada data untuk kelas ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE */}
            <div className="block md.hidden">
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Kelas
                </label>
                <select
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-black focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  {daftarKelas.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              {visible.length === 0 ? (
                <p className="text-center text-xs text-gray-500">
                  Tidak ada data untuk kelas ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {visible.map((row, idx) => (
                    <div
                      key={row.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
                    >
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-[10px] font-semibold text-slate-500">
                          {idx + 1}.
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {row.nama_siswa}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                        <span className="text-[10px] text-slate-500">
                          NISN: {row.nisn}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Kelas: {row.kelas}
                        </span>
                      </div>

                      <div className="mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-semibold text-slate-800">
                            Total Juz, Target, Tercapai
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] text-slate-500 mb-0.5">
                              Total
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={row.tahfidz_total_juz ?? ""}
                              onChange={(e) =>
                                setData((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          tahfidz_total_juz: e.target.value,
                                        }
                                      : r
                                  )
                                )
                              }
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-black text-center focus:ring-2 focus:ring-sky-400"
                              placeholder="0"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] text-slate-500 mb-0.5">
                              Target
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={row.tahfidz_target_lembar ?? ""}
                              onChange={(e) =>
                                setData((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          tahfidz_target_lembar: e.target.value,
                                        }
                                      : r
                                  )
                                )
                              }
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-black text-center focus:ring-2 focus:ring-sky-400"
                              placeholder="0"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] text-slate-500 mb-0.5">
                              Tercapai
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={row.tahfidz_tercapai_lembar ?? ""}
                              onChange={(e) =>
                                setData((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          tahfidz_tercapai_lembar:
                                            e.target.value,
                                        }
                                      : r
                                  )
                                )
                              }
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-black text-center focus:ring-2 focus:ring-sky-400"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mb-2">
                        <label className="block text-[11px] font-semibold text-slate-800 mb-1">
                          Nilai
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row.tahfidz_nilai ?? ""}
                          onChange={(e) =>
                            setData((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      tahfidz_nilai: e.target.value,
                                    }
                                  : r
                              )
                            )
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] text-black text-center focus:ring-2 focus:ring-sky-400"
                          placeholder="0-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-800 mb-1">
                          Keterangan
                        </label>
                        <textarea
                          rows={3}
                          value={row.tahfidz_keterangan ?? ""}
                          onChange={(e) =>
                            setData((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      tahfidz_keterangan: e.target.value,
                                    }
                                  : r
                              )
                            )
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-[11px] text-black focus:ring-2 focus:ring-indigo-400"
                          placeholder="Contoh: Lancar juz 2 dan setoran rutin"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex items-center justify-end">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 disabled:opacity-50 text-white px-6 py-2 rounded-full shadow-lg hover:from-green-600 hover:to-teal-600 transition text-sm font-semibold"
          >
            {saving ? "💾 Menyimpan.." : "💾 Simpan Semua"}
          </button>
        </div>
      </div>
    </div>
  );
}
