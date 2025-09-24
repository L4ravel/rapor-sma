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

  // Dataset mapel pondok dari Firestore
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

  /* ---- Load dataset mapel pondok ---- */
  useEffect(() => {
    const fetchDatasetMapel = async () => {
      try {
        let snap;
        try {
          snap = await getDocs(query(collection(db, "dataset_mapel_pondok"), orderBy("createdAt", "asc")));
        } catch {
          snap = await getDocs(collection(db, "dataset_mapel_pondok"));
        }
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMapelPondokList(list);
        if (!selectedMapelPondok && list.length > 0) {
          setSelectedMapelPondok(list[0].nama);
        }
      } catch (e) {
        console.error("Gagal ambil dataset_mapel_pondok:", e);
      }
    };
    fetchDatasetMapel();
  }, []);

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
          capaianPondok: nested.capaian ?? r[`capaian_${selectedMapelPondok}`] ?? "", // optional, kalau nanti dipakai
        };
      });

      setData(merged);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal mengambil data");
    } finally {
      if (withSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  useEffect(() => {
    if (selectedMapelPondok) fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapelPondok]);

  /* ---- Filter + Limit 50 ---- */
  const filtered = useMemo(
    () => data.filter((r) => (selectedKelas ? r.kelas === selectedKelas : true)),
    [data, selectedKelas]
  );
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
    window.confirm("Perubahan belum disimpan. Yakin ingin melanjutkan? Perubahan akan hilang.");

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
    const rows = (selectedKelas ? data.filter((d) => d.kelas === selectedKelas) : data).map((r) => [
      r.nisn, r.nama_siswa, r.kelas, ""
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `template-nilai-pondok-${selectedMapelPondok || "mapel"}-${selectedKelas || "ALL"}.xlsx`);
  };

  const downloadCurrentXLSX = async () => {
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const header = ["nisn", "nama_siswa", "kelas", `nilai_${selectedMapelPondok}`];
    const rows = (selectedKelas ? data.filter((d) => d.kelas === selectedKelas) : data).map((r) => [
      String(r.nisn ?? ""),
      r.nama_siswa ?? "",
      r.kelas ?? "",
      r.nilaiPondok ?? "",
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `data-nilai-pondok-${selectedMapelPondok || "mapel"}-${selectedKelas || "ALL"}.xlsx`);
  };

  /* ========= Upload Excel (preview) ========= */
  const onUploadXLSX = async (file) => {
    if (!file) return;
    if (!XLSXRef.current) XLSXRef.current = await import("xlsx");
    const XLSX = XLSXRef.current;

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }); // a-o-a

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

    const idxNisn  = idxByName(["nisn"]);
    const idxNama  = idxByName(["nama", "namasiswa", "nama_siswa"]);
    const idxKelas = idxByName(["kelas"]);

    const mNorm = norm(selectedMapelPondok);
    const kandidatNilai = [`nilai`, `nilai_${selectedMapelPondok}`, `nilai_${mNorm}`];

    let idxNilai = idxByName(kandidatNilai);
    if (idxNilai === -1) {
      idxNilai = headerNorm.findIndex((hn) => hn.startsWith("nilai_") && hn.includes(mNorm));
    }

    if (idxNisn === -1) {
      alert("Header wajib memuat kolom: nisn.");
      return;
    }

    const existingNisn = new Set(data.map((d) => String(d.nisn || "").trim()).filter(Boolean));

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
          continue; // tidak menambah siswa baru
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
        await setDoc(ref, { nisn: row.nisn, nama_siswa: row.nama_siswa, kelas: row.kelas }, { merge: true });

        // nested + legacy (kompatibel dengan versi lama)
        const updates = {
          [`pondok.${selectedMapelPondok}.nilai`]: numNilai,
          [selectedMapelPondok]: numNilai,
        };

        await updateDoc(ref, updates);
      }
      alert("✅ Nilai mapel pondok tersimpan!");
      setImportInfo({ rows: 0, updated: 0, skippedNew: 0 });
      setDirty(false);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  /* =============== UI =============== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 md:p-10">
      <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-black">📗 Input Nilai — Mapel Pondok</h1>
          <button onClick={() => guardedNavigate("/input-nilai")} className="text-black hover:underline text-sm">
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
              Preview: {importInfo.rows} baris • Update: {importInfo.updated} • Di-skip (NISN baru): {importInfo.skippedNew}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-center text-black">⏳ Memuat data...</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-300/50 shadow-md">
            <table className="w-full text-sm overflow-hidden rounded-2xl border border-gray-300/50">
              <thead className="sticky top-0 z-10">
                {/* Baris 1 */}
                <tr className="bg-gradient-to-r from-emerald-200 to-teal-200 text-black text-xs">
                  <th rowSpan={2} className="p-1 w-2 border border-gray-300/50 text-center">No</th>
                  <th rowSpan={2} className="p-1 w-4 border border-gray-300/50 text-center">NISN</th>
                  <th rowSpan={2} className="p-1 w-8 border border-gray-300/50 text-center">Nama</th>
                  <th className="p-2 w-20 border border-gray-300/50 text-center">Daftar Kelas</th>
                  <th className="p-2 border border-gray-300/50 text-center">INPUT NILAI MAPEL PONDOK</th>
                </tr>
                {/* Baris 2 */}
                <tr className="bg-gradient-to-r from-emerald-100 to-teal-100 text-black text-xs">
                  {/* Kelas */}
                  <th className="p-2 w-20 border border-gray-300/50 text-center">
                    <select
                      value={selectedKelas}
                      onChange={(e) => handleChangeKelas(e.target.value)}
                      className="w-full rounded-md bg-white text-black px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">Semua</option>
                      {daftarKelas.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </th>

                  {/* Dropdown Mapel Pondok */}
                  <th className="p-2 w-28 border border-gray-300/50 text-center">
                    <select
                      value={selectedMapelPondok}
                      onChange={(e) => handleChangeMapel(e.target.value)}
                      className="w-full rounded-md bg-white text-black px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-400"
                    >
                      {mapelPondokList.length === 0 ? (
                        <option value="">(dataset kosong)</option>
                      ) : (
                        mapelPondokList.map((m) => (
                          <option key={m.id} value={m.nama}>
                            {m.arab ? `${m.nama} (${m.arab})` : m.nama}
                          </option>
                        ))
                      )}
                    </select>
                  </th>
                </tr>
              </thead>

              <tbody>
                {visible.map((row, idx) => (
                  <tr
                    key={row.nisn || row.id || idx}
                    className={`transition hover:bg-emerald-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="p-1 text-center border border-gray-300/50 text-black">{idx + 1}</td>
                    <td className="p-1 text-center border border-gray-300/50 text-black truncate" title={row.nisn}>{row.nisn}</td>
                    <td className="p-1 border border-gray-300/50 text-black truncate" title={row.nama_siswa}>{row.nama_siswa}</td>
                    <td className="p-2 text-center border border-gray-300/50 text-black">{row.kelas}</td>

                    {/* Nilai */}
                    <td className="p-2 w-20 text-center border border-gray-300/50 align-top">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={row.nilaiPondok ?? ""}
                        onChange={(e) => {
                          const v = clampScore(e.target.value);
                          setDirty(true);
                          setData((prev) => prev.map((r) => (r.nisn === row.nisn ? { ...r, nilaiPondok: v } : r)));
                        }}
                        className="w-full border rounded-md px-2 py-2 text-xs text-black text-center focus:ring-2 focus:ring-emerald-400 min-h-[60px]"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between">
          <Link href="/input-nilai/umum" className="text-sm text-black hover:underline">
            → Pindah ke Mapel Umum
          </Link>
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
