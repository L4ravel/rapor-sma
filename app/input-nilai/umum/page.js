"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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

/* ================= Helpers ================= */
const clampScore = (v) => {
  if (v === "" || v === null || v === undefined) return "";
  let n = parseInt(String(v).trim(), 10);
  if (Number.isNaN(n)) return "";
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return String(n);
};
const limitChars = (text, max = 150) =>
  !text ? "" : String(text).slice(0, max);
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/* ================ Page ================ */
export default function InputNilaiUmumPage() {
  const router = useRouter();

  const [data, setData] = useState([]); // siswa + nilai mapel terpilih
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // mapel umum dari collection mapel_umum
  const [mapelUmumList, setMapelUmumList] = useState([]);
  const [selectedMapelUmum, setSelectedMapelUmum] = useState("");

  const [selectedKelas, setSelectedKelas] = useState("");

  // import Excel preview
  const [importInfo, setImportInfo] = useState({
    rows: 0,
    updated: 0,
    skippedNew: 0,
  });
  const fileInputRef = useRef(null);

  // unsaved changes guard
  const [dirty, setDirty] = useState(false);

  // XLSX (lazy import agar aman di client)
  const XLSXRef = useRef(null);
  useEffect(() => {
    (async () => {
      if (!XLSXRef.current) {
        const mod = await import("xlsx");
        XLSXRef.current = mod;
      }
    })();
  }, []);

  /* ---- Load mapel umum dari collection mapel_umum ---- */
  useEffect(() => {
    const fetchMapelUmum = async () => {
      try {
        let snap;
        try {
          // Coba dengan order by createdAt
          snap = await getDocs(
            query(collection(db, "mapel_umum"), orderBy("createdAt", "asc"))
          );
        } catch {
          // Fallback tanpa order jika tidak ada index
          snap = await getDocs(collection(db, "mapel_umum"));
        }

        const list = snap.docs.map((d) => ({
          id: d.id,
          nama: d.data().nama || "",
          kelas: d.data().kelas || "",
          createdAt: d.data().createdAt,
        }));

        setMapelUmumList(list);
        if (!selectedMapelUmum && list.length > 0) {
          setSelectedMapelUmum(list[0].nama);
        }
      } catch (e) {
        console.error("Gagal ambil mapel_umum:", e);
        alert("Gagal mengambil data mapel umum dari database");
      }
    };
    fetchMapelUmum();
  }, [selectedMapelUmum]);

  /* ---- Filter mapel berdasarkan kelas yang dipilih ---- */
  const availableMapel = useMemo(() => {
    if (!selectedKelas) {
      return mapelUmumList; // Tampilkan semua mapel jika tidak ada filter kelas
    }
    return mapelUmumList.filter(
      (mapel) => !mapel.kelas || mapel.kelas === selectedKelas
    );
  }, [mapelUmumList, selectedKelas]);

  /* ---- Auto-update selected mapel jika tidak tersedia di kelas yang dipilih ---- */
  useEffect(() => {
    if (selectedKelas && availableMapel.length > 0) {
      const isMapelAvailable = availableMapel.some(
        (m) => m.nama === selectedMapelUmum
      );
      if (!isMapelAvailable) {
        setSelectedMapelUmum(availableMapel[0].nama);
      }
    }
  }, [selectedKelas, availableMapel, selectedMapelUmum]);

  /* ---- Load siswa & rapor ---- */
  const fetchData = async (withSpinner = true) => {
    try {
      if (withSpinner) setLoading(true);
      const sSnap = await getDocs(collection(db, "siswa"));
      const siswa = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const kelasUnik = [
        ...new Set(siswa.map((s) => s.kelas).filter(Boolean)),
      ];
      setDaftarKelas(kelasUnik);

      const rapSnap = await getDocs(collection(db, "raport"));
      const rap = Object.fromEntries(rapSnap.docs.map((d) => [d.id, d.data()]));

      // merge flat + nested (fallback)
      const merged = siswa.map((s) => {
        const r = rap[s.nisn] || {};
        const nested = r?.umum?.[selectedMapelUmum] || {};
        const nilaiFlat = r[selectedMapelUmum];
        const capaianFlat = r[`capaian_${selectedMapelUmum}`];
        return {
          ...s,
          id: s.id || s.nisn, // stabil id
          nilaiUmum: nested.nilai ?? nilaiFlat ?? "",
          capaianUmum: nested.capaian ?? capaianFlat ?? "",
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
    fetchData(true);
  }, []);

  // Jika mapel berubah → reload data (tapi guarded via handler khusus)
  useEffect(() => {
    if (selectedMapelUmum) fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapelUmum]);

  /* ---- Auto pilih kelas pertama (supaya selalu per-kelas, konsisten dengan pondok) ---- */
  useEffect(() => {
    if (!selectedKelas && daftarKelas.length > 0) {
      setSelectedKelas(daftarKelas[0]);
    }
  }, [daftarKelas, selectedKelas]);

  /* ---- Filter siswa berdasarkan kelas dan urutkan berdasarkan nama A-Z ---- */
  const filtered = useMemo(() => {
    // kalau belum ada kelas terpilih, jangan tampilkan apa pun dulu
    if (!selectedKelas) return [];

    const result = data
      .filter((r) => r.kelas === selectedKelas)
      .slice() // copy dulu sebelum sort
      .sort((a, b) => {
        const namaA = (a.nama_siswa || "").toLowerCase();
        const namaB = (b.nama_siswa || "").toLowerCase();
        return namaA.localeCompare(namaB);
      });

    return result;
  }, [data, selectedKelas]);

  const visible = filtered.slice(0, 50);

  /* ---- Unsaved changes guard: refresh/close tab ---- */
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = ""; // Chrome requires returnValue set
    };
    if (dirty) {
      window.addEventListener("beforeunload", onBeforeUnload);
    }
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /* ---- Guarded actions ---- */
  const confirmLoseChanges = () =>
    window.confirm(
      "Perubahan belum disimpan. Yakin ingin melanjutkan? Perubahan akan hilang."
    );

  const handleChangeMapel = (val) => {
    if (dirty && !confirmLoseChanges()) return;
    setDirty(false); // reset indikator; kita akan muat ulang data bersih
    setSelectedMapelUmum(val);
  };

  const handleChangeKelas = (val) => {
    if (dirty && !confirmLoseChanges()) return;
    setSelectedKelas(val);
  };

  const guardedNavigate = (href) => {
    if (dirty && !confirmLoseChanges()) return;
    router.push(href);
  };

  /* ---- Simpan (anti ketimpa) ---- */
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      for (const row of filtered) {
        const ref = doc(collection(db, "raport"), String(row.nisn));

        // normalisasi input
        const safeNilai = clampScore(row.nilaiUmum);
        const numNilai = safeNilai === "" ? null : Number(safeNilai);
        const safeCapaian = limitChars(row.capaianUmum, 150);

        // pastikan doc ada (tidak overwrite field lain)
        await setDoc(
          ref,
          { nisn: row.nisn, nama_siswa: row.nama_siswa, kelas: row.kelas },
          { merge: true }
        );

        // update hanya field terkait mapel ini (nested + legacy flat)
        const updates = {
          [`umum.${selectedMapelUmum}.nilai`] : numNilai,
          [`umum.${selectedMapelUmum}.capaian`] : safeCapaian ?? "",
          [selectedMapelUmum]: numNilai, // legacy (kompatibel)
          [`capaian_${selectedMapelUmum}`]: safeCapaian ?? "", // legacy (kompatibel)
        };

        await updateDoc(ref, updates);
      }
      alert("Nilai mapel umum tersimpan!");
      setImportInfo({ rows: 0, updated: 0, skippedNew: 0 });
      setDirty(false); // aman setelah simpan
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  /* ========= Download Excel ========= */
  const downloadTemplateXLSX = async () => {
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const header = ["nisn", "nama_siswa", "kelas", "nilai", "capaian"];
    const rows = (selectedKelas
      ? data.filter((d) => d.kelas === selectedKelas)
      : data
    )
      .slice()
      .sort((a, b) => {
        const namaA = (a.nama_siswa || "").toLowerCase();
        const namaB = (b.nama_siswa || "").toLowerCase();
        return namaA.localeCompare(namaB);
      })
      .map((r) => [r.nisn, r.nama_siswa, r.kelas, "", ""]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 10 },
      { wch: 8 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(
      wb,
      `template-nilai-umum-${selectedMapelUmum}-${selectedKelas || "ALL"}.xlsx`
    );
  };

  const downloadCurrentXLSX = async () => {
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const header = [
      "nisn",
      "nama_siswa",
      "kelas",
      `nilai_${selectedMapelUmum}`,
      `capaian_${selectedMapelUmum}`,
    ];
    const rows = (selectedKelas
      ? data.filter((d) => d.kelas === selectedKelas)
      : data
    )
      .slice()
      .sort((a, b) => {
        const namaA = (a.nama_siswa || "").toLowerCase();
        const namaB = (b.nama_siswa || "").toLowerCase();
        return namaA.localeCompare(namaB);
      })
      .map((r) => [
        String(r.nisn ?? ""),
        r.nama_siswa ?? "",
        r.kelas ?? "",
        r.nilaiUmum ?? "",
        r.capaianUmum ?? "",
      ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 10 },
      { wch: 10 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(
      wb,
      `data-nilai-umum-${selectedMapelUmum}-${selectedKelas || "ALL"}.xlsx`
    );
  };

  /* ========= Upload Excel ========= */
  const onUploadXLSX = async (file) => {
    if (!file) return;
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const buf = await file.arrayBuffer();
    // raw:false → pakai display text; leading zero tetap
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }); // array-of-arrays

    if (!rows || !rows.length) {
      alert("Excel kosong / tidak terbaca.");
      return;
    }

    // deteksi header
    const header = rows[0].map((h) => String(h ?? "").trim());
    const headerNorm = header.map((h) => norm(h));
    const hasHeader = headerNorm.includes("nisn");
    const startIdx = hasHeader ? 1 : 0;

    // cari index kolom fleksibel
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

    // kolom nilai & capaian: "nilai" ATAU "nilai_<mapel>" (bebas spasi/kurung)
    const mNorm = norm(selectedMapelUmum);
    const kandidatNilai = [
      `nilai`,
      `nilai_${selectedMapelUmum}`,
      `nilai_${mNorm}`,
    ];
    const kandidatCapa = [
      `capaian`,
      `capaian_${selectedMapelUmum}`,
      `capaian_${mNorm}`,
    ];

    let idxNilai = idxByName(kandidatNilai);
    if (idxNilai === -1) {
      idxNilai = headerNorm.findIndex(
        (hn) => hn.startsWith("nilai_") && hn.includes(mNorm)
      );
    }
    let idxCapaian = idxByName(kandidatCapa);
    if (idxCapaian === -1) {
      idxCapaian = headerNorm.findIndex(
        (hn) => hn.startsWith("capaian_") && hn.includes(mNorm)
      );
    }

    if (idxNisn === -1) {
      alert("Header wajib memuat kolom: nisn.");
      return;
    }

    // Set NISN yang valid (hanya update existing, no-create)
    const existingNisn = new Set(
      data.map((d) => String(d.nisn || "").trim()).filter(Boolean)
    );

    let rowsCount = 0;
    let updated = 0;
    let skippedNew = 0;

    // merge ke state → langsung terlihat (BELUM commit)
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
          continue; // ◆JANGAN TAMBAH BARU
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
          patch.nilaiUmum = clampScore(r[idxNilai]);
        }
        if (idxCapaian !== -1 && r[idxCapaian] != null) {
          patch.capaianUmum = limitChars(r[idxCapaian], 150);
        }

        updated++;
        map.set(nisn, patch);
      }

      return Array.from(map.values());
    });

    setImportInfo({ rows: rowsCount, updated, skippedNew });
    setDirty(true); // perubahan dari upload = kotor
  };

  const triggerUpload = () => fileInputRef.current?.click();

  /* ================== UI ================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-0">
    <div className="bg-white w-full min-h-screen px-3 py-4 md:px-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-black">
            📘 Input Nilai — Mapel Umum
          </h1>

          {/* Back guarded */}
          <button
            onClick={() => guardedNavigate("/")}
            className="text-black hover:underline text-sm"
          >
            ← Kembali ke Beranda
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

        {/* Tabel / List */}
        {loading ? (
          <p className="text-center text-black">⏳ Memuat data...</p>
        ) : (
          <>
            {/* === FILTER MOBILE (di atas tabel) === */}
            <div className="mb-4 grid grid-cols-1 gap-3 md:hidden">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelas
                </label>
                <select
                  value={selectedKelas}
                  onChange={(e) => handleChangeKelas(e.target.value)}
                  className="w-full rounded-md bg-white text-black px-3 py-2 text-xs border border-gray-300 focus:ring-2 focus:ring-purple-400"
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
                  Mapel Umum
                </label>
                <select
                  value={selectedMapelUmum}
                  onChange={(e) => handleChangeMapel(e.target.value)}
                  className="w-full rounded-md bg-white text-black px-3 py-2 text-xs border border-gray-300 focus:ring-2 focus:ring-purple-400"
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
                        {m.nama}
                        {m.kelas && !selectedKelas
                          ? ` - Kelas ${m.kelas}`
                          : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* === MOBILE LIST: Nama, Nilai, Capaian (tanpa kolom Kelas) === */}
            <div className="md:hidden">
              {visible.length === 0 ? (
                <div className="rounded-2xl border border-gray-300/60 bg-white p-6 text-center text-gray-500 text-sm">
                  {availableMapel.length === 0
                    ? selectedKelas
                      ? `Tidak ada mapel umum untuk kelas ${selectedKelas}`
                      : "Tidak ada data mapel umum"
                    : "Tidak ada siswa yang sesuai dengan filter"}
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((row, idx) => (
                    <div
                      key={row.nisn || row.id || idx}
                      className="rounded-2xl border border-gray-300/60 bg-white shadow-sm p-3"
                    >
                      {/* Nama */}
                      <div
                        className="text-xs font-semibold text-black mb-2 truncate"
                        title={row.nama_siswa}
                      >
                        {idx + 1}. {row.nama_siswa}
                      </div>

                      {/* Nilai */}
                      <div className="grid grid-cols-[auto,80px] gap-2 items-center mb-2">
                        <span className="text-[11px] text-slate-600">
                          Nilai
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={row.nilaiUmum ?? ""}
                          onChange={(e) => {
                            const v = clampScore(e.target.value);
                            setDirty(true);
                            setData((prev) =>
                              prev.map((r) =>
                                r.nisn === row.nisn
                                  ? { ...r, nilaiUmum: v }
                                  : r
                              )
                            );
                          }}
                          className="w-full border rounded-md px-2 py-1.5 text-xs text-black text-center focus:ring-2 focus:ring-purple-400"
                          placeholder="0"
                        />
                      </div>

                      {/* Capaian Kompetensi di bawah Nilai */}
                      <div>
                        <div className="text-[11px] text-slate-600 mb-1">
                          Capaian Kompetensi
                        </div>
                        <textarea
                          value={row.capaianUmum ?? ""}
                          onChange={(e) => {
                            const v = limitChars(e.target.value, 150);
                            setDirty(true);
                            setData((prev) =>
                              prev.map((r) =>
                                r.nisn === row.nisn
                                  ? { ...r, capaianUmum: v }
                                  : r
                              )
                            );
                          }}
                          maxLength={150}
                          className="w-full border rounded-md px-2 py-1.5 text-xs text-black focus:ring-2 focus:ring-purple-400 resize-none min-h-[60px]"
                          placeholder="Tulis capaian singkat (maks 150 karakter)"
                        />
                        <div className="mt-1 text-[10px] text-slate-400 text-right">
                          {(row.capaianUmum?.length || 0)}/150
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* === DESKTOP TABLE (tetap seperti semula) === */}
            <div className="hidden md:block">
              <div className="overflow-x-auto rounded-2xl border border-gray-300/50 shadow-md">
                <table className="w-full text-sm table-auto overflow-hidden rounded-2xl border border-gray-300/50">
  <thead className="sticky top-0 z-10">
    {/* Baris 1 */}
    <tr className="bg-gradient-to-r from-indigo-200 to-purple-200 text-black text-xs">
      <th className="p-1 w-[40px] border border-gray-300/50 text-center">
        No
      </th>
      <th className="p-1 w-[80px] border border-gray-300/50 text-center">
        NISN
      </th>
      <th className="p-1 w-[280px] border border-gray-300/50 text-center">
        Nama
      </th>
      <th className="p-2 w-[60px] border border-gray-300/50 text-center">
        Filter Kelas
      </th>
      <th
        colSpan={2}
        className="p-2 border border-gray-300/50 text-center"
      >
        INPUT NILAI MAPEL UMUM
      </th>
    </tr>

    {/* Baris 2 */}
    <tr className="bg-gradient-to-r from-indigo-100 to-purple-100 text-black text-xs">
      <th className="p-1 border border-gray-300/50" />
      <th className="p-1 border border-gray-300/50" />
      <th className="p-1 border border-gray-300/50" />

      {/* Filter Kelas */}
      <th className="p-2 w-[60px] border border-gray-300/50 text-center">
        <select
          value={selectedKelas}
          onChange={(e) => handleChangeKelas(e.target.value)}
          className="w-full rounded-md bg-white text-black px-2 py-1 text-xs focus:ring-2 focus:ring-purple-400"
        >
          {daftarKelas.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </th>

      {/* Dropdown Mapel umum - kolom NILAI (lebih kecil) */}
      <th className="p-2 w-[80px] border border-gray-300/50 text-center">
        <select
          value={selectedMapelUmum}
          onChange={(e) => handleChangeMapel(e.target.value)}
          className="w-full rounded-md bg-white text-black px-2 py-1 text-[12px] focus:ring-2 focus:ring-purple-400"
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
                {m.nama}
                {m.kelas && !selectedKelas ? ` - Kelas ${m.kelas}` : ""}
              </option>
            ))
          )}
        </select>
      </th>

      {/* Header Capaian Kompetensi - kolom lebar */}
      <th className="p-2 w-[260px] border border-gray-300/50 text-center">
        Capaian Kompetensi
      </th>
    </tr>
  </thead>

  <tbody>
    {visible.length === 0 ? (
      <tr>
        <td
          colSpan={6}
          className="p-8 text-center text-gray-500"
        >
          {availableMapel.length === 0
            ? selectedKelas
              ? `Tidak ada mapel umum untuk kelas ${selectedKelas}`
              : "Tidak ada data mapel umum"
            : "Tidak ada siswa yang sesuai dengan filter"}
        </td>
      </tr>
    ) : (
      visible.map((row, idx) => (
        <tr
          key={row.nisn || row.id || idx}
          className={`transition hover:bg-purple-50 ${
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

          {/* Kolom NILAI - sempit */}
          <td className="p-2 w-[80px] text-center border border-gray-300/50 align-top">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={row.nilaiUmum ?? ""}
              onChange={(e) => {
                const v = clampScore(e.target.value);
                setDirty(true);
                setData((prev) =>
                  prev.map((r) =>
                    r.nisn === row.nisn ? { ...r, nilaiUmum: v } : r
                  )
                );
              }}
              className="w-full border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-purple-400 min-h-[60px]"
              placeholder="0"
            />
          </td>

          {/* Kolom CAPAIAN - lebar */}
          <td className="p-2 w-[260px] border border-gray-300/50 align-top">
            <textarea
              value={row.capaianUmum ?? ""}
              onChange={(e) => {
                const v = limitChars(e.target.value, 150);
                setDirty(true);
                setData((prev) =>
                  prev.map((r) =>
                    r.nisn === row.nisn ? { ...r, capaianUmum: v } : r
                  )
                );
              }}
              maxLength={150}
              className="w-full h-[60px] border rounded-md px-2 py-2 text-sm text-black focus:ring-2 focus:ring-purple-400 shadow-sm resize-none"
              placeholder="Tulis capaian kompetensi siswa (maks 150 karakter)"
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
          <button
            onClick={() => guardedNavigate("/input-nilai/pondok")}
            className="text-sm text-black hover:underline"
          >
            → Pindah ke Mapel Pondok
          </button>
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
