"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ================ Helpers ================ */
const clampScore = (v) => {
  if (v === "" || v === null || v === undefined) return "";
  let n = parseInt(String(v).trim(), 10);
  if (Number.isNaN(n)) return "";
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return String(n);
};
const limitChars = (text, max = 150) => (!text ? "" : String(text).slice(0, max));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/* ================ Page ================ */
export default function InputNilaiPondokPage() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dataset mapel pondok dari collection mapel_pondok
  const [mapelPondokList, setMapelPondokList] = useState([]);
  const [selectedMapelPondok, setSelectedMapelPondok] = useState("");

  const [selectedKelas, setSelectedKelas] = useState("");
  const [dirty, setDirty] = useState(false);

  // Import Excel
  const [importInfo, setImportInfo] = useState({ rows: 0, updated: 0, skippedNew: 0 });
  const fileInputRef = useRef(null);
  const XLSXRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (!XLSXRef.current) {
        const mod = await import("xlsx");
        XLSXRef.current = mod;
      }
    })();
  }, []);

  /* ---- Load mapel pondok dari collection mapel_pondok ---- */
  useEffect(() => {
    const fetchMapelPondok = async () => {
      try {
        let snap;
        try {
          // Coba dengan order by createdAt
          snap = await getDocs(
            query(collection(db, "mapel_pondok"), orderBy("createdAt", "asc"))
          );
        } catch {
          // Fallback tanpa order jika tidak ada index
          snap = await getDocs(collection(db, "mapel_pondok"));
        }

        const list = snap.docs.map((d) => ({
          id: d.id,
          nama: d.data().nama || "",
          arab: d.data().arab || "",
          kelas: d.data().kelas || "",
          createdAt: d.data().createdAt,
        }));

        setMapelPondokList(list);
        if (!selectedMapelPondok && list.length > 0) {
          setSelectedMapelPondok(list[0].nama);
        }
      } catch (e) {
        console.error("Gagal ambil mapel_pondok:", e);
        alert("Gagal mengambil data mapel pondok dari database");
      }
    };
    fetchMapelPondok();
  }, [selectedMapelPondok]);

  /* ---- Load siswa & rapor ---- */
  const fetchData = async (withSpinner = true) => {
    try {
      if (withSpinner) setLoading(true);

      // siswa
      const siswaSnap = await getDocs(collection(db, "siswa"));
      const siswa = siswaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // kelas unik
      const kelasUnik = [...new Set(siswa.map((s) => s.kelas).filter(Boolean))];
      setDaftarKelas(kelasUnik);

      // rapor
      const rapSnap = await getDocs(collection(db, "raport"));
      const rap = Object.fromEntries(rapSnap.docs.map((d) => [d.id, d.data()]));

      // gabungkan (nested + legacy fallback)
      const merged = siswa.map((s) => {
        const r = rap[s.nisn] || {};
        const nested = r?.pondok?.[selectedMapelPondok] || {};
        const nilaiFlat = r[selectedMapelPondok];

        return {
          ...s,
          id: s.id || s.nisn,
          nilaiPondok: nested.nilai ?? nilaiFlat ?? "",
          capaianPondok: nested.capaian ?? r[`capaian_${selectedMapelPondok}`] ?? "",
        };
      });

      setData(merged);
    } catch (e) {
      console.error(e);
      alert("Gagal mengambil data siswa dan rapor");
    } finally {
      if (withSpinner) setLoading(false);
    }
  };

  useEffect(() => {
  // kalau belum ada kelas terpilih, otomatis pakai kelas pertama
  if (!selectedKelas && daftarKelas.length > 0) {
    setSelectedKelas(daftarKelas[0]);
  }
}, [daftarKelas, selectedKelas]);

  useEffect(() => {
    fetchData(true);
  }, []);

  useEffect(() => {
    if (selectedMapelPondok) fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapelPondok]);

  /* ---- Filter mapel berdasarkan kelas yang dipilih ---- */
  const availableMapel = useMemo(() => {
    if (!selectedKelas) {
      return mapelPondokList; // Tampilkan semua mapel jika tidak ada filter kelas
    }
    return mapelPondokList.filter(
      (mapel) => !mapel.kelas || mapel.kelas === selectedKelas
    );
  }, [mapelPondokList, selectedKelas]);

  /* ---- Auto-update selected mapel jika tidak tersedia di kelas yang dipilih ---- */
  useEffect(() => {
    if (selectedKelas && availableMapel.length > 0) {
      const isMapelAvailable = availableMapel.some(
        (m) => m.nama === selectedMapelPondok
      );
      if (!isMapelAvailable) {
        setSelectedMapelPondok(availableMapel[0].nama);
      }
    }
  }, [selectedKelas, availableMapel, selectedMapelPondok]);

  /* ---- Filter siswa berdasarkan kelas + SORT NAMA A→Z ---- */
  const filtered = useMemo(() => {
  // kalau belum ada kelas terpilih, jangan tampilkan apa pun dulu
  if (!selectedKelas) return [];

  const result = data.filter((r) => r.kelas === selectedKelas);

  // urutkan berdasarkan nama_siswa (A-Z)
  return [...result].sort((a, b) =>
    String(a?.nama_siswa || "").localeCompare(
      String(b?.nama_siswa || ""),
      "id",
      { sensitivity: "base" }
    )
  );
}, [data, selectedKelas]);

  const visible = useMemo(() => filtered.slice(0, 50), [filtered]);

  /* ---- Unsaved changes guard ---- */
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    if (dirty) window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const confirmLoseChanges = () =>
    window.confirm(
      "Perubahan belum disimpan. Yakin ingin melanjutkan? Perubahan akan hilang."
    );

  const handleChangeMapel = (val) => {
    if (dirty && !confirmLoseChanges()) return;
    setDirty(false);
    setSelectedMapelPondok(val);
  };
  const handleChangeKelas = (val) => {
    if (dirty && !confirmLoseChanges()) return;
    setSelectedKelas(val);
  };
  const guardedNavigate = (href) => {
    if (dirty && !confirmLoseChanges()) return;
    router.push(href);
  };

  /* ========= Download Excel ========= */
  const downloadTemplateXLSX = async () => {
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const header = ["nisn", "nama_siswa", "kelas", "nilai"];
    const rows = (selectedKelas
      ? data.filter((d) => d.kelas === selectedKelas)
      : data
    ).map((r) => [r.nisn, r.nama_siswa, r.kelas, ""]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(
      wb,
      `template-nilai-pondok-${selectedMapelPondok || "mapel"}-${
        selectedKelas || "ALL"
      }.xlsx`
    );
  };

  const downloadCurrentXLSX = async () => {
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const header = ["nisn", "nama_siswa", "kelas", `nilai_${selectedMapelPondok}`];
    const rows = (selectedKelas
      ? data.filter((d) => d.kelas === selectedKelas)
      : data
    ).map((r) => [
      String(r.nisn ?? ""),
      r.nama_siswa ?? "",
      r.kelas ?? "",
      r.nilaiPondok ?? "",
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(
      wb,
      `data-nilai-pondok-${selectedMapelPondok || "mapel"}-${
        selectedKelas || "ALL"
      }.xlsx`
    );
  };

  /* ========= Upload Excel (preview) ========= */
  const onUploadXLSX = async (file) => {
    if (!file) return;
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

    if (!rows || !rows.length) {
      alert("Excel kosong / tidak terbaca.");
      return;
    }

    const header = rows[0].map((h) => String(h ?? "").trim());
    const headerNorm = header.map((h) => norm(h));
    const hasHeader = headerNorm.includes("nisn");
    const startIdx = hasHeader ? 1 : 0;

    const idxByName = (names) => {
      for (const name of names) {
        const i = headerNorm.indexOf(norm(name));
        if (i !== -1) return i;
      }
      return -1;
    };

    const idxNisn = idxByName(["nisn"]);
    const idxNama = idxByName(["nama", "namasiswa", "nama_siswa"]);
    const idxKelas = idxByName(["kelas"]);

    const mNorm = norm(selectedMapelPondok);
    const kandidatNilai = [`nilai`, `nilai_${selectedMapelPondok}`, `nilai_${mNorm}`];

    let idxNilai = idxByName(kandidatNilai);
    if (idxNilai === -1) {
      idxNilai = headerNorm.findIndex(
        (hn) => hn.startsWith("nilai_") && hn.includes(mNorm)
      );
    }

    if (idxNisn === -1) {
      alert("Header wajib memuat kolom: nisn.");
      return;
    }

    const existingNisn = new Set(
      data.map((d) => String(d.nisn || "").trim()).filter(Boolean)
    );

    let rowsCount = 0;
    let updated = 0;
    let skippedNew = 0;

    setData((prev) => {
      const map = new Map(prev.map((p) => [String(p.nisn).trim(), { ...p }]));

      for (let i = startIdx; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;

        const nisnRaw = r[idxNisn];
        const nisn = String(nisnRaw ?? "").trim();
        if (!nisn) continue;

        rowsCount++;

        if (!existingNisn.has(nisn)) {
          skippedNew++;
          continue;
        }

        const old = map.get(nisn);
        const patch = { ...(old || {}), id: old?.id || nisn, nisn };

        if (idxNama !== -1 && r[idxNama] != null) {
          const nm = String(r[idxNama]).trim();
          if (nm) patch.nama_siswa = nm;
        }
        if (idxKelas !== -1 && r[idxKelas] != null) {
          const kl = String(r[idxKelas]).trim();
          if (kl) patch.kelas = kl;
        }
        if (idxNilai !== -1 && r[idxNilai] != null) {
          patch.nilaiPondok = clampScore(r[idxNilai]);
        }

        updated++;
        map.set(nisn, patch);
      }

      return Array.from(map.values());
    });

    setImportInfo({ rows: rowsCount, updated, skippedNew });
    setDirty(true);
  };

  const triggerUpload = () => fileInputRef.current?.click();

  /* ========= Simpan ========= */
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      for (const row of filtered) {
        const ref = doc(collection(db, "raport"), String(row.nisn));

        const safeNilai = clampScore(row.nilaiPondok);
        const numNilai = safeNilai === "" ? null : Number(safeNilai);

        // pastikan doc ada & tidak tabrak field lain
        await setDoc(
          ref,
          { nisn: row.nisn, nama_siswa: row.nama_siswa, kelas: row.kelas },
          { merge: true }
        );

        // nested + legacy (kompatibel dengan versi lama)
        const updates = {
          [`pondok.${selectedMapelPondok}.nilai`]: numNilai,
          [selectedMapelPondok]: numNilai,
        };

        await updateDoc(ref, updates);
      }
      alert("Nilai mapel pondok tersimpan!");
      setImportInfo({ rows: 0, updated: 0, skippedNew: 0 });
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const emptyMessage =
    availableMapel.length === 0
      ? selectedKelas
        ? `Tidak ada mapel pondok untuk kelas ${selectedKelas}`
        : "Tidak ada data mapel pondok"
      : "Tidak ada siswa yang sesuai dengan filter";

  /* =============== UI =============== */
  return (
     <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-0">
    <div className="bg-white w-full min-h-screen px-3 py-4 md:px-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-black">
            📗 Input Nilai — Mapel Pondok
          </h1>
          <button
            onClick={() => guardedNavigate("/input-nilai")}
            className="text-black hover:underline text-sm"
          >
            ← Kembali
          </button>
        </div>

        {/* Toolbar atas */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={downloadTemplateXLSX}
            className="px-3 py-2 rounded-md text-sm bg-slate-900 text-white hover:bg-slate-800"
          >
            ⬇️ Download Template Excel
          </button>
          <button
            onClick={downloadCurrentXLSX}
            className="px-3 py-2 rounded-md text-sm bg-slate-700 text-white hover:bg-slate-600"
          >
            ⬇️ Download Data Saat Ini (Excel)
          </button>
          <button
            onClick={triggerUpload}
            className="px-3 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700"
          >
            ⬆️ Import Data Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => onUploadXLSX(e.target.files?.[0])}
          />

          {importInfo.rows > 0 && (
            <span className="ml-auto text-sm text-slate-600">
              Preview: {importInfo.rows} baris • Update: {importInfo.updated} •
              Di-skip (NISN baru): {importInfo.skippedNew}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-center text-black">⏳ Memuat data...</p>
        ) : (
          <>
            {/* Filter atas untuk kelas & mapel (mobile & desktop) */}
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
  Filter Kelas
</label>
<select
  value={selectedKelas}
  onChange={(e) => handleChangeKelas(e.target.value)}
  className="w-full rounded-md bg-white text-black px-3 py-2 text-xs md:text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-400"
>
  {daftarKelas.map((k) => (
    <option key={k} value={k}>
      {k}
    </option>
  ))}
</select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mapel Pondok
                </label>
                <select
                  value={selectedMapelPondok}
                  onChange={(e) => handleChangeMapel(e.target.value)}
                  className="w-full rounded-md bg-white text-black px-3 py-2 text-xs md:text-sm border border-gray-300 focus:ring-2 focus:ring-emerald-400"
                >
                  {availableMapel.length === 0 ? (
                    <option value="">
                      {selectedKelas
                        ? `(tidak ada mapel untuk kelas ${selectedKelas})`
                        : "(tidak ada mapel)"}
                    </option>
                  ) : (
                    availableMapel.map((m) => (
                      <option key={m.id} value={m.nama}>
                        {m.arab ? `${m.nama} (${m.arab})` : m.nama}
                        {m.kelas && !selectedKelas ? ` - Kelas ${m.kelas}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Tabel mobile: hanya Nama & Nilai */}
            <div className="md:hidden">
              <div className="rounded-2xl border border-gray-300/50 shadow-md overflow-hidden">
                {visible.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    {emptyMessage}
                  </div>
                ) : (
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-gradient-to-r from-emerald-200 to-teal-200 text-black text-xs">
                      <tr>
                        <th className="p-2 border border-gray-300/50 text-left">
                          Nama
                        </th>
                        <th className="p-2 border border-gray-300/50 text-center w-28">
                          {/* w-28: kolom nilai lebih lebar di mobile */}
                          Nilai
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row, idx) => (
                        <tr
                          key={row.nisn || row.id || idx}
                          className={`transition hover:bg-emerald-50 ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <td className="p-2 border border-gray-300/50 text-black">
  <div
    className="text-xs font-semibold truncate"
    title={row.nama_siswa}
  >
    {idx + 1}. {row.nama_siswa}
  </div>
</td>
                          <td className="p-2 border border-gray-300/50 text-center align-top w-28">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={row.nilaiPondok ?? ""}
                              onChange={(e) => {
                                const v = clampScore(e.target.value);
                                setDirty(true);
                                setData((prev) =>
                                  prev.map((r) =>
                                    r.nisn === row.nisn
                                      ? { ...r, nilaiPondok: v }
                                      : r
                                  )
                                );
                              }}
                              className="w-full border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-emerald-400"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Tabel desktop: lengkap */}
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-2xl border border-gray-300/50 shadow-md">
                 <table className="w-full text-sm table-fixed overflow-hidden rounded-2xl border border-gray-300/50">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-emerald-200 to-teal-200 text-black text-xs">
                     <th className="p-1 w-[40px] border border-gray-300/50 text-center">
                        No
                      </th>
                      <th className="p-1 w-[100px] border border-gray-300/50 text-center">
                        NISN
                      </th>
                      <th className="p-1 w-[220px] border border-gray-300/50 text-center">
                        Nama
                      </th>
                      <th className="p-1 w-[80px] border border-gray-300/50 text-center">
                        Kelas
                      </th>
                      <th className="p-2 w-[140px] border border-gray-300/50 text-center">
                        INPUT NILAI MAPEL PONDOK
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visible.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center text-gray-500"
                        >
                          {emptyMessage}
                        </td>
                      </tr>
                    ) : (
                      visible.map((row, idx) => (
                        <tr
                          key={row.nisn || row.id || idx}
                          className={`transition hover:bg-emerald-50 ${
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

                          {/* Nilai */}
                          <td className="p-2 w-32 text-center border border-gray-300/50 align-top">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={row.nilaiPondok ?? ""}
                              onChange={(e) => {
                                const v = clampScore(e.target.value);
                                setDirty(true);
                                setData((prev) =>
                                  prev.map((r) =>
                                    r.nisn === row.nisn
                                      ? { ...r, nilaiPondok: v }
                                      : r
                                  )
                                );
                              }}
                              className="w-full border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-emerald-400 min-h-[60px]"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/input-nilai/umum"
            className="text-sm text-black hover:underline"
          >
            → Pindah ke Mapel Umum
          </Link>
          <button
            onClick={handleSaveAll}
            disabled={saving || availableMapel.length === 0}
            className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 disabled:opacity-50 text-white px-6 py-2 rounded-full shadow-lg hover:from-green-600 hover:to-teal-600 transition text-sm font-semibold"
          >
            {saving ? "💾 Menyimpan..." : "💾 Simpan Semua"}
          </button>
        </div>
      </div>
    </div>
  );
}
