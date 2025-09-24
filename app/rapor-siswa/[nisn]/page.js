"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

const FIX_KEYS = [
  "nisn",
  "nama_siswa",
  "kelas",
  "semester",
  "tahun_pelajaran",
  "sakit",
  "izin",
  "alpha",
  "fase",
  "catatan_wali",
];

// Normalisasi nilai agar tidak me-render object langsung
function normalizeNilai(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v.nilai === "number" || typeof v.nilai === "string") return v.nilai;
    if (typeof v.value === "number" || typeof v.value === "string") return v.value;
    try {
      const pairs = Object.entries(v).map(([k, val]) =>
        `${k}: ${typeof val === "object" ? JSON.stringify(val) : String(val)}`
      );
      return pairs.join("; ");
    } catch {
      return String(v);
    }
  }
  return String(v);
}

// Normalisasi capaian agar selalu string
function normalizeCapaian(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const cand = v.deskripsi ?? v.teks ?? v.text;
    if (typeof cand === "string") return cand;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export default function DetailRaporSiswa() {
  const { nisn } = useParams();
  const [rapor, setRapor] = useState(null);
  const [loading, setLoading] = useState(true);

  const [dsUmum, setDsUmum] = useState([]);     // [{nama}]
  const [dsPondok, setDsPondok] = useState([]); // [{nama, arab?}]
  const [loadingDs, setLoadingDs] = useState(true);

  // Ambil data rapor by docId = NISN
  useEffect(() => {
    const run = async () => {
      try {
        const id = String(nisn || "").trim();
        if (!id) return;
        const snap = await getDoc(doc(db, "raport", id));
        if (snap.exists()) setRapor(snap.data());
      } catch (e) {
        console.error("Gagal ambil rapor:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [nisn]);

  // Ambil dataset mapel (umum & pondok)
  useEffect(() => {
    const run = async () => {
      try {
        let sUmum;
        try {
          sUmum = await getDocs(query(collection(db, "dataset_mapel_umum"), orderBy("createdAt", "asc")));
        } catch {
          sUmum = await getDocs(collection(db, "dataset_mapel_umum"));
        }
        setDsUmum(sUmum.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));

        let sPondok;
        try {
          sPondok = await getDocs(query(collection(db, "dataset_mapel_pondok"), orderBy("createdAt", "asc")));
        } catch {
          sPondok = await getDocs(collection(db, "dataset_mapel_pondok"));
        }
        setDsPondok(sPondok.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } catch (e) {
        console.error("Gagal ambil dataset mapel:", e);
      } finally {
        setLoadingDs(false);
      }
    };
    run();
  }, []);

  // ==== Semua hooks di bawah ini SELALU dipanggil ====

  const rap = rapor || {};
  const allKeys = useMemo(() => Object.keys(rap), [rap]);

  const capaianMap = useMemo(() => {
    const m = {};
    for (const k of allKeys) {
      if (k.startsWith("capaian_")) {
        m[k.slice("capaian_".length)] = rap[k];
      }
    }
    return m;
  }, [allKeys, rap]);

  const nilaiKeys = useMemo(
    () => allKeys.filter((k) => !FIX_KEYS.includes(k) && !k.startsWith("capaian_")),
    [allKeys]
  );

  const namaUmumSet = useMemo(
    () => new Set(dsUmum.map((d) => String(d.nama || "").toLowerCase())),
    [dsUmum]
  );
  const namaPondokSet = useMemo(
    () => new Set(dsPondok.map((d) => String(d.nama || "").toLowerCase())),
    [dsPondok]
  );

  const idxUmum = useMemo(() => {
    const m = new Map();
    dsUmum.forEach((d, i) => m.set(String(d.nama || "").toLowerCase(), i));
    return m;
  }, [dsUmum]);

  const idxPondok = useMemo(() => {
    const m = new Map();
    dsPondok.forEach((d, i) => m.set(String(d.nama || "").toLowerCase(), i));
    return m;
  }, [dsPondok]);

  const fmt = (s) => (s && s.includes("_") ? s.replace(/_/g, " ") : s || "");
  const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== "";

  // Rows UMUM: hanya mapel yang ada di dataset umum
  const rowsUmum = useMemo(() => {
    if (!nilaiKeys.length) return [];
    const rows = nilaiKeys
      .filter((k) => namaUmumSet.has(String(k).toLowerCase()))
      .map((k) => {
        const rawNilai = rap[k];
        const nilai = normalizeNilai(rawNilai);
        const capKey1 = k;
        const capKey2 = k.replace(/_/g, " ");
        const capaian = normalizeCapaian(capaianMap[capKey1] ?? capaianMap[capKey2] ?? "");
        return { mapel: k, nilai, capaian };
      })
      .filter((r) => hasValue(r.nilai) && hasValue(r.capaian));

    rows.sort((a, b) => {
      const ia = idxUmum.get(String(a.mapel).toLowerCase());
      const ib = idxUmum.get(String(b.mapel).toLowerCase());
      if (ia != null && ib != null && ia !== ib) return ia - ib;
      return a.mapel.localeCompare(b.mapel, "id");
    });
    return rows;
  }, [nilaiKeys, namaUmumSet, rap, capaianMap, idxUmum]);

  // Rows PONDOK: hanya mapel yang ada di dataset pondok
  const rowsPondok = useMemo(() => {
    if (!nilaiKeys.length) return [];
    const rows = nilaiKeys
      .filter((k) => namaPondokSet.has(String(k).toLowerCase()))
      .map((k) => ({ mapel: k, nilai: normalizeNilai(rap[k]) }))
      .filter((r) => hasValue(r.nilai));

    rows.sort((a, b) => {
      const ia = idxPondok.get(String(a.mapel).toLowerCase());
      const ib = idxPondok.get(String(b.mapel).toLowerCase());
      if (ia != null && ib != null && ia !== ib) return ia - ib;
      return a.mapel.localeCompare(b.mapel, "id");
    });
    return rows;
  }, [nilaiKeys, namaPondokSet, rap, idxPondok]);

  // ==== Setelah semua hooks dipanggil, baru conditional return ====

  if (loading || loadingDs) return <p className="p-8 text-black">⏳ Memuat data...</p>;
  if (!rapor) return <p className="p-8 text-red-600">❌ Data tidak ditemukan</p>;

  const TableUmum = () => (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-6">
      <h2 className="bg-indigo-200 text-black p-3 font-semibold">📗 Mapel Umum</h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-indigo-100 text-black">
          <tr>
            <th className="w-1/12 p-3 text-center border border-gray-200">No</th>
            <th className="w-4/12 p-3 text-left  border border-gray-200">Mata Pelajaran</th>
            <th className="w-1/12 p-3 text-center border border-gray-200">Nilai</th>
            <th className="w-6/12 p-3 text-left  border border-gray-200">Capaian</th>
          </tr>
        </thead>
        <tbody className="text-black">
          {rowsUmum.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-3 text-center text-gray-600 border border-gray-200">
                Tidak ada data mapel umum (dataset kosong atau belum ada nilai).
              </td>
            </tr>
          ) : (
            rowsUmum.map((r, i) => (
              <tr key={r.mapel} className="hover:bg-gray-50">
                <td className="p-3 text-center border border-gray-200">{i + 1}</td>
                <td className="p-3 border border-gray-200">{fmt(r.mapel)}</td>
                <td className="p-3 text-center font-semibold border border-gray-200">{r.nilai}</td>
                <td className="p-3 border border-gray-200 whitespace-pre-wrap break-words">
                  {r.capaian}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const TablePondok = () => (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-4">
      <h2 className="bg-emerald-200 text-black p-3 font-semibold">📘 Mapel Pondok</h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-emerald-100 text-black">
          <tr>
            <th className="w-1/12 p-3 text-center border border-gray-200">No</th>
            <th className="w-7/12 p-3 text-left  border border-gray-200">Mata Pelajaran</th>
            <th className="w-4/12 p-3 text-center border border-gray-200">Nilai</th>
          </tr>
        </thead>
        <tbody className="text-black">
          {rowsPondok.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-3 text-center text-gray-600 border border-gray-200">
                Tidak ada data mapel pondok (dataset kosong atau belum ada nilai).
              </td>
            </tr>
          ) : (
            rowsPondok.map((r, i) => (
              <tr key={r.mapel} className="hover:bg-gray-50">
                <td className="p-3 text-center border border-gray-200">{i + 1}</td>
                <td className="p-3 border border-gray-200">{fmt(r.mapel)}</td>
                <td className="p-3 text-center font-semibold border border-gray-200">{r.nilai}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  /* === TABEL KHUSUS: HAFALAN AL-QUR'AN (bukan "tahsin") ===
     Membaca rap.hafalan (fallback rap.tahfidz) -> { total_juz, target_lembar, tercapai_lembar, keterangan, nilai }
     Ditaruh DI BAWAH Mapel Pondok. */
const TableHafalan = () => {
  const hafalan = rap.hafalan || rap.tahfidz || {};
  const totalJuz = normalizeNilai(hafalan.total_juz ?? "");
  const target = normalizeNilai(hafalan.target_lembar ?? "");
  const tercapai = normalizeNilai(hafalan.tercapai_lembar ?? "");
  const ket = normalizeCapaian(hafalan.keterangan ?? "");
  const nilai = normalizeNilai(hafalan.nilai ?? "");

  const kosong =
    String(totalJuz) === "" &&
    String(target) === "" &&
    String(tercapai) === "" &&
    String(ket) === "" &&
    String(nilai) === "";

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-6">
      <h2 className="bg-emerald-100 text-black p-3 font-semibold">
        📖 Hafalan Al-Qur’an
      </h2>

      {kosong ? (
        <div className="p-4 text-sm text-gray-600">
          Belum ada data hafalan untuk siswa ini.
        </div>
      ) : (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="bg-gray-50 text-black">
            <tr>
              <th className="p-3 text-left border border-gray-200 w-1/2">Penilaian Hafalan Al-Qur’an</th>
              <th className="p-3 text-left border border-gray-200 w-1/2"></th>
            </tr>
          </thead>
          <tbody className="text-black">
            <tr>
              <td className="p-2 border border-gray-200">Total Hafalan</td>
              <td className="p-2 border border-gray-200">{totalJuz || "0"} Juz</td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-200">Target Semester</td>
              <td className="p-2 border border-gray-200">{target || "0"} Lembar</td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-200">Ketercapaian Semester Ini</td>
              <td className="p-2 border border-gray-200">{tercapai || "0"} Lembar</td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-200">Keterangan</td>
              <td className="p-2 border border-gray-200 whitespace-pre-wrap break-words">
                {ket || "—"}
              </td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-200">Nilai</td>
              <td className="p-2 border border-gray-200">{nilai || "0"}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};


  const TableAbsensi = () => (
    <div className="bg-white shadow rounded-lg overflow-hidden mt-6">
      <h2 className="text-lg font-semibold text-black p-4 border-b">📌 Absensi</h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-indigo-100 text-black">
          <tr>
            <th className="w-1/3 p-3 text-center border border-gray-200">Sakit</th>
            <th className="w-1/3 p-3 text-center border border-gray-200">Izin</th>
            <th className="w-1/3 p-3 text-center border border-gray-200">Alpha</th>
          </tr>
        </thead>
        <tbody className="text-black">
          <tr className="text-center">
            <td className="p-3 border border-gray-200">{normalizeNilai(rap.sakit) || 0}</td>
            <td className="p-3 border border-gray-200">{normalizeNilai(rap.izin) || 0}</td>
            <td className="p-3 border border-gray-200">{normalizeNilai(rap.alpha) || 0}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const TableCatatanWali = () => (
    <div className="bg-white shadow rounded-lg mt-6">
      <h2 className="text-lg font-semibold text-black p-4 border-b">📝 Catatan Wali Kelas</h2>
      <div className="p-5">
        <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-800 leading-relaxed">
          {rap.catatan_wali && String(rap.catatan_wali).trim() !== ""
            ? rap.catatan_wali
            : "— (Belum ada catatan dari wali kelas)"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-6 text-center">📚 Rapor Siswa</h1>

        {/* Biodata */}
        <div className="bg-white shadow rounded-lg p-6 mb-6 text-black">
          <h2 className="text-lg font-semibold mb-4">📄 Biodata Siswa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p><span className="font-semibold">NISN:</span> {rap.nisn}</p>
            <p><span className="font-semibold">Nama:</span> {rap.nama_siswa}</p>
            <p><span className="font-semibold">Kelas:</span> {rap.kelas}</p>
            <p><span className="font-semibold">Semester:</span> {rap.semester || "-"}</p>
            <p><span className="font-semibold">Tahun:</span> {rap.tahun_pelajaran || "-"}</p>
          </div>
        </div>

        <TableUmum />
        <TablePondok />
        {/* >>> Tambahan: Tabel Hafalan di bawah pondok <<< */}
        <TableHafalan />
        <TableAbsensi />
        <TableCatatanWali />

        {/* Cetak */}
        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <Link
            href={`/rapor-siswa/${nisn}/cetak-umum`}
            className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition"
          >
            🖨️ Cetak Rapor Umum
          </Link>
          <Link
            href={`/rapor-siswa/${nisn}/cetak-pondok`}
            className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700 transition"
          >
            🖨️ Cetak Rapor Pondok
          </Link>
        </div>
      </div>
    </div>
  );
}
