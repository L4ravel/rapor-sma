<<<<<<< HEAD
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ——— util normalisasi nilai & capaian (tanpa TypeScript types) ——— */
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

const FASE_E_KELAS = [
  "10A1","10A2","10A3","10A4",
  "10B1","10B2","10B3","10B4",
];

function resolveFase(kelas, faseDb) {
  if (FASE_E_KELAS.includes(String(kelas || "").toUpperCase())) {
    return "E";
  }
  return faseDb || "-";
}

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

export default function CetakRaporUmum() {
  const { nisn } = useParams();
  const [rapor, setRapor] = useState(null);
  const [wali, setWali] = useState(null);
  const [bio, setBio] = useState(null);

  // Dataset mapel umum (dinamis)
  const [dsUmum, setDsUmum] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDs, setLoadingDs] = useState(true);

  // 1) Ambil rapor by nisn
  useEffect(() => {
    const run = async () => {
      try {
        const q = query(collection(db, "raport"), where("nisn", "==", nisn));
        const snap = await getDocs(q);
        if (!snap.empty) setRapor(snap.docs[0].data());
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [nisn]);

  // 2) Ambil bio sekolah
  useEffect(() => {
    const loadBio = async () => {
      try {
        const snap = await getDoc(doc(db, "bio_sekolah", "default"));
        if (snap.exists()) {
          setBio(snap.data());
        }
      } catch (err) {
        console.error("Gagal ambil bio sekolah", err);
      }
    };
    loadBio();
  }, []);

  // 3) Ambil dataset mapel umum
  useEffect(() => {
    const run = async () => {
      try {
        let sUmum;
        try {
          sUmum = await getDocs(
            query(collection(db, "dataset_mapel_umum"), orderBy("createdAt", "asc"))
          );
        } catch {
          // jika belum ada index/field createdAt
          sUmum = await getDocs(collection(db, "dataset_mapel_umum"));
        }
        setDsUmum(sUmum.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } catch (e) {
        console.error("Gagal ambil dataset mapel umum", e);
      } finally {
        setLoadingDs(false);
      }
    };
    run();
  }, []);

  // 4) Ambil wali kelas berdasarkan kelas rapor
  useEffect(() => {
    const run = async () => {
      if (!rapor?.kelas) return;
      try {
        const snap = await getDocs(
          query(collection(db, "wali_kelas"), where("kelas", "==", rapor.kelas))
        );
        if (!snap.empty) setWali(snap.docs[0].data());
      } catch (e) {
        console.error("Gagal ambil wali kelas", e);
      }
    };
    run();
  }, [rapor?.kelas]);

  const data = rapor;

  const allKeys = useMemo(() => (data ? Object.keys(data) : []), [data]);

  // Kumpulkan capaian_
  const capaianMap = useMemo(() => {
    const m = {};
    for (const k of allKeys) {
      if (k.startsWith("capaian_")) {
        m[k.slice("capaian_".length)] = data[k];
      }
    }
    return m;
  }, [allKeys, data]);

  // Semua kandidat nilai (tanpa FIX_KEYS & tanpa key capaian_)
  const nilaiKeys = useMemo(
    () => allKeys.filter((k) => !FIX_KEYS.includes(k) && !k.startsWith("capaian_")),
    [allKeys]
  );

  // Indeks urutan dataset
  const idxUmum = useMemo(() => {
    const m = new Map();
    dsUmum.forEach((d, i) => m.set(String(d.nama || "").toLowerCase(), i));
    return m;
  }, [dsUmum]);

  // Set nama dari dataset (untuk filter)
  const namaUmumSet = useMemo(
    () => new Set(dsUmum.map((d) => String(d.nama || "").toLowerCase())),
    [dsUmum]
  );

  // Helper
  const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== "";
  const fmt = (s) => (s && s.includes("_") ? s.replace(/_/g, " ") : s || "");
  const norm = (s) => String(s || "").toLowerCase();

  // 5) Build rowsUmum berdasar dataset + urut sesuai index dataset
  const rowsUmum = useMemo(() => {
    if (!data) return [];
    const rows = nilaiKeys
      .filter((k) => namaUmumSet.has(norm(k)))
      .map((k) => {
        const nilai = normalizeNilai(data[k]);
        const capKey1 = k;
        const capKey2 = k.replace(/_/g, " ");
        const capaian = normalizeCapaian(capaianMap[capKey1] ?? capaianMap[capKey2] ?? "");
        return { mapel: k, nilai, capaian };
      })
      .filter((r) => hasValue(r.nilai) && hasValue(r.capaian));

    rows.sort((a, b) => {
      const ia = idxUmum.get(norm(a.mapel));
      const ib = idxUmum.get(norm(b.mapel));
      if (ia != null && ib != null && ia !== ib) return ia - ib;
      return a.mapel.localeCompare(b.mapel, "id");
    });

    return rows;
  }, [data, nilaiKeys, namaUmumSet, capaianMap, idxUmum]);

  if (loading || loadingDs) return <p className="p-4 text-black">⏳ Memuat...</p>;
  if (!data) return <p className="p-4 text-red-600">❌ Data rapor tidak ditemukan.</p>;

  function formatNamaGelar(str) {
    if (!str) return "—";
    const parts = str.trim().split(" ");
    if (parts.length === 1) return str.toUpperCase();
    const gelar = parts.pop();
    const nama = parts.join(" ").toUpperCase();
    return `${nama} ${gelar}`;
  }

  const biodata = {
    nisn: data.nisn || "-",
    nama: data.nama_siswa || "-",
    kelas: data.kelas || "-",
    semester: data.semester || "-",
    tahun: data.tahun_pelajaran || "-",
    fase: data.fase || "",
  };

  // ⬇️ URL tanda tangan kepala sekolah (ambil dari beberapa kemungkinan field)
  const ttdKepalaSekolahUrl =
    bio?.kepala_sekolah_ttd || bio?.kepala_sekolah_foto || "";

  // ⬇️ Waktu pembagian rapor (ambil dari bio_sekolah)
  const waktuPembagianRaport =
    bio?.waktuPembagianRaport || "Jadwal belum ditentukan";

  // Komponen kecil untuk kop (dipakai di setiap halaman)
  const HeaderIdentitas = () => (
    <div
      className="leading-snug kop-print-only"
      style={{ fontSize: "11pt" }}
    >
      <div className="grid grid-cols-[1.3fr_1fr] gap-x-20">
        {/* Kolom kiri */}
        <div className="space-y-1">
          <div className="flex">
            <span className="w-36">Nama</span>
            <span className="w-4 text-center">:</span>
            <span className="font-bold">{biodata.nama}</span>
          </div>
          <div className="flex">
            <span className="w-36">NIS/NISN</span>
            <span className="w-4 text-center">:</span>
            <span>- / {biodata.nisn}</span>
          </div>
          <div className="flex">
            <span className="w-36">Nama Sekolah</span>
            <span className="w-4 text-center">:</span>
            <span className="whitespace-nowrap">{bio?.nama_sekolah || "—"}</span>
          </div>
          <div className="flex">
            <span className="w-36">Alamat</span>
            <span className="w-4 text-center">:</span>
            <span className="whitespace-nowrap">{bio?.alamat || "—"}</span>
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="space-y-1">
          <div className="flex">
            <span className="w-32">Kelas</span>
            <span className="w-4 text-center">:</span>
            <span className="font-bold">{biodata.kelas}</span>
          </div>
          <div className="flex">
            <span className="w-32">Semester</span>
            <span className="w-4 text-center">:</span>
            {/* khusus umum: ambil dari bio.semesterUmum */}
            <span>{bio?.semesterUmum || biodata.semester}</span>
          </div>
          <div className="flex">
            <span className="w-32">Fase</span>
            <span className="w-4 text-center">:</span>
            <span>{resolveFase(biodata.kelas, bio?.fase || biodata.fase)}</span>
          </div>
          <div className="flex">
            <span className="w-32">Tahun Pelajaran</span>
            <span className="w-4 text-center">:</span>
            {/* khusus umum: ambil dari bio.tahunPelajaranUmum */}
            <span>{bio?.tahunPelajaranUmum || biodata.tahun}</span>
          </div>
        </div>
      </div>

      {/* Garis pemisah penuh */}
      <div className="border-b border-black mt-2.5" />
    </div>
  );

  return (
    <div
      className="min-h-screen bg-white text-black pb-10"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* Wrapper responsif di layar, fix 210mm di print */}
      <div className="mx-auto w-full max-w-[210mm] px-2 print:w-[210mm] print:px-0">
        {/* ========= HALAMAN 1 ========= */}
        <div className="p-4 print:p-6 print:min-h-[297mm]">
          {/* Kop halaman 1 */}
          <HeaderIdentitas />

          {/* Judul */}
          <div className="judul-rapor text-center mt-8 mb-6 leading-none">
            <div className="font-semibold tracking-wide">
              LAPORAN HASIL BELAJAR
            </div>
            {/* <div className="font-semibold tracking-wide">
              SUMATIF AKHIR SEMESTER
            </div> */}
          </div>

          {/* Tabel nilai umum */}
          <div className="mt-2 overflow-x-auto print:overflow-visible">
            <table className="w-full border border-black border-collapse">
              <thead className="bg-purple-100 text-[11px] font-bold">
                <tr>
                  <th className="w-[32px] border border-black p-0 h-10 text-center align-middle">
                    No
                  </th>
                  <th className="w-[140] border border-black p-0 h-10 text-center align-middle">
                    Mata Pelajaran
                  </th>
                  <th className="w-[60] border border-black p-0 h-10 text-center align-middle">
                    Nilai Akhir
                  </th>
                  <th className="w-[370px] border border-black p-0 h-10 text-center align-middle">
                    Capaian Kompetensi
                  </th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {rowsUmum.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-black p-0 text-center align-middle"
                    >
                      Tidak ada data (dataset kosong atau belum ada nilai/capaian).
                    </td>
                  </tr>
                ) : (
                  rowsUmum.map((r, i) => (
                    <tr key={r.mapel}>
                      <td className="border border-black p-0.5 text-center align-middle">
                        {i + 1}
                      </td>
                      <td className="border border-black p-0.5 text-left align-middle">
                        {fmt(r.mapel)}
                      </td>
                      <td className="border border-black p-0.5 text-center align-middle font-semibold">
                        {r.nilai}
                      </td>
                      <td className="border border-black p-0.5 text-left align-middle whitespace-pre-wrap break-words">
                        {r.capaian}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

  {/* TANDA TANGAN WALI KELAS — PRINT ONLY (SAMA TEMPLATE HALAMAN 2) */}
<div className="hidden print:block mt-10">
  <div className="overflow-x-auto print:overflow-visible">
    <table className="w-full text-[11px] leading-tight">
      <tbody>
        <tr>
          <td className="w-1/2" />
          <td className="w-1/2 align-top p-2 text-right">
            <div>{waktuPembagianRaport}</div>
            <div>Wali Kelas,</div>

            <div className="mt-16 inline-block text-left">
              <div className="font-bold underline">
                {formatNamaGelar(wali?.nama_wali)}
              </div>
              <div>NIP.</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

          {/* Ekstrakurikuler */}
          <div className="mt-3 overflow-x-auto print:overflow-visible page-break-before">
            <HeaderIdentitas />

          <div className="hidden print:block mt-8" />
            <table className="w-full border border-black border-collapse text-[11px]">
              <thead className="bg-purple-100 font-bold">
                <tr>
                  <th className="w-[32px] border border-black text-center">No</th>
                  <th className="w-[170] border border-black text-center">
                    Kegiatan Ekstrakurikuler
                  </th>
                  <th className="w-[100px] border border-black text-center">
                    Predikat
                  </th>
                  <th className="w-[300px] border border-black text-center">
                    Keterangan
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2].map((n) => (
                  <tr key={n}>
                    <td className="border border-black text-center p-1">{n}</td>
                    <td className="border border-black p-1">&nbsp;</td>
                    <td className="border border-black text-center p-1">&nbsp;</td>
                    <td className="border border-black p-1">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Absensi */}
          <div className="mt-3 grid grid-cols-1 gap-4">
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border border-black border-collapse mt-4">
                <thead className="bg-purple-100 text-[11px] font-bold">
                  <tr>
                    <th className="w-[100px] border border-black text-center align-middle">
                      Keterangan
                    </th>
                    <th className="w-[80px] border border-black text-center align-middle">
                      Jumlah Absensi
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[10px]">
                  <tr>
                    <td className="border border-black text-left p-1 whitespace-nowrap">
                      Sakit
                    </td>
                    <td className="border border-black text-center p-1">
                      {data.sakit || 0} hari
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black text-left p-1 whitespace-nowrap">
                      Izin
                    </td>
                    <td className="border border-black text-center p-1">
                      {data.izin || 0} hari
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black text-left p-1 whitespace-nowrap">
                      Tanpa Keterangan
                    </td>
                    <td className="border border-black text-center p-1">
                      {data.alpha || 0} hari
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Catatan wali kelas (akhir halaman 1) */}
          <div className="mt-4">
            <div className="font-bold mb-1 text-[11px]">Catatan Wali Kelas</div>
            <div className="border border-black p-2 text-[11px] leading-tight whitespace-pre-wrap break-words text-center">
              {data.catatan_wali && String(data.catatan_wali).trim() !== ""
                ? data.catatan_wali
                : "— (Belum ada catatan wali kelas)"}
            </div>
          </div>
        </div>

        {/* ========= HALAMAN 2 (TANDA TANGAN) ========= */}
        <div className="p-4 print:p-6 print:min-h-[297mm]">
          

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-[11px] leading-tight">
              <tbody>
                {/* Baris 1: Orang Tua/Wali | Wali Kelas */}
                <tr>
                  <td className="w-1/2 align-top p-2">
                    <div>Mengetahui</div>
                    <div>Orang Tua/Wali,</div>
                    <div className="mt-16">......................</div>
                  </td>

                  <td className="w-1/2 align-top p-2 text-right">
                    <div>{waktuPembagianRaport}</div>
                    <div>Wali Kelas,</div>
                    <div className="mt-16 inline-block text-left">
                      <div className="font-bold underline">
                        {formatNamaGelar(wali?.nama_wali)}
                      </div>
                      <div>NIP.</div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td colSpan={2} className="p-2 text-center align-top">
                    <div>Mengetahui</div>
                    <div>Kepala Sekolah</div>

                    {/* area tanda tangan */}
                    <div className="mt-3 inline-block text-center">
                      {ttdKepalaSekolahUrl && (
                        <div className="mb-0.5 flex justify-center">
                          <img
                            src={ttdKepalaSekolahUrl}
                            alt="Tanda tangan Kepala Sekolah"
                            className="h-16 w-40 object-contain"
                          />
                        </div>
                      )}

                      <div className="inline-block text-left">
  <div className="font-bold underline">
    {formatNamaGelar(bio?.kepala_sekolah)}
  </div>
  <div>NIP.</div>
</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Tombol Download (hide saat print) */}
        <div className="mt-3 px-4 print:hidden flex justify-center">
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-3 py-1.5 rounded text-[11px]"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
=======
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ——— util normalisasi nilai & capaian (tanpa TypeScript types) ——— */
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

const FASE_E_KELAS = [
  "10A1","10A2","10A3","10A4",
  "10B1","10B2","10B3","10B4",
];

function resolveFase(kelas, faseDb) {
  if (FASE_E_KELAS.includes(String(kelas || "").toUpperCase())) {
    return "E";
  }
  return faseDb || "-";
}

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

export default function CetakRaporUmum() {
  const { nisn } = useParams();
  const [rapor, setRapor] = useState(null);
  const [wali, setWali] = useState(null);
  const [bio, setBio] = useState(null);

  // Dataset mapel umum (dinamis)
  const [dsUmum, setDsUmum] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDs, setLoadingDs] = useState(true);

  // 1) Ambil rapor by nisn
  useEffect(() => {
    const run = async () => {
      try {
        const q = query(collection(db, "raport"), where("nisn", "==", nisn));
        const snap = await getDocs(q);
        if (!snap.empty) setRapor(snap.docs[0].data());
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [nisn]);

  // 2) Ambil bio sekolah
  useEffect(() => {
    const loadBio = async () => {
      try {
        const snap = await getDoc(doc(db, "bio_sekolah", "default"));
        if (snap.exists()) {
          setBio(snap.data());
        }
      } catch (err) {
        console.error("Gagal ambil bio sekolah", err);
      }
    };
    loadBio();
  }, []);

  // 3) Ambil dataset mapel umum
  useEffect(() => {
    const run = async () => {
      try {
        let sUmum;
        try {
          sUmum = await getDocs(
            query(collection(db, "dataset_mapel_umum"), orderBy("createdAt", "asc"))
          );
        } catch {
          // jika belum ada index/field createdAt
          sUmum = await getDocs(collection(db, "dataset_mapel_umum"));
        }
        setDsUmum(sUmum.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } catch (e) {
        console.error("Gagal ambil dataset mapel umum", e);
      } finally {
        setLoadingDs(false);
      }
    };
    run();
  }, []);

  // 4) Ambil wali kelas berdasarkan kelas rapor
  useEffect(() => {
    const run = async () => {
      if (!rapor?.kelas) return;
      try {
        const snap = await getDocs(
          query(collection(db, "wali_kelas"), where("kelas", "==", rapor.kelas))
        );
        if (!snap.empty) setWali(snap.docs[0].data());
      } catch (e) {
        console.error("Gagal ambil wali kelas", e);
      }
    };
    run();
  }, [rapor?.kelas]);

  const data = rapor;

  const allKeys = useMemo(() => (data ? Object.keys(data) : []), [data]);

  // Kumpulkan capaian_
  const capaianMap = useMemo(() => {
    const m = {};
    for (const k of allKeys) {
      if (k.startsWith("capaian_")) {
        m[k.slice("capaian_".length)] = data[k];
      }
    }
    return m;
  }, [allKeys, data]);

  // Semua kandidat nilai (tanpa FIX_KEYS & tanpa key capaian_)
  const nilaiKeys = useMemo(
    () => allKeys.filter((k) => !FIX_KEYS.includes(k) && !k.startsWith("capaian_")),
    [allKeys]
  );

  // Indeks urutan dataset
  const idxUmum = useMemo(() => {
    const m = new Map();
    dsUmum.forEach((d, i) => m.set(String(d.nama || "").toLowerCase(), i));
    return m;
  }, [dsUmum]);

  // Set nama dari dataset (untuk filter)
  const namaUmumSet = useMemo(
    () => new Set(dsUmum.map((d) => String(d.nama || "").toLowerCase())),
    [dsUmum]
  );

  // Helper
  const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== "";
  const fmt = (s) => (s && s.includes("_") ? s.replace(/_/g, " ") : s || "");
  const norm = (s) => String(s || "").toLowerCase();

  // 5) Build rowsUmum berdasar dataset + urut sesuai index dataset
  const rowsUmum = useMemo(() => {
    if (!data) return [];
    const rows = nilaiKeys
      .filter((k) => namaUmumSet.has(norm(k)))
      .map((k) => {
        const nilai = normalizeNilai(data[k]);
        const capKey1 = k;
        const capKey2 = k.replace(/_/g, " ");
        const capaian = normalizeCapaian(capaianMap[capKey1] ?? capaianMap[capKey2] ?? "");
        return { mapel: k, nilai, capaian };
      })
      .filter((r) => hasValue(r.nilai) && hasValue(r.capaian));

    rows.sort((a, b) => {
      const ia = idxUmum.get(norm(a.mapel));
      const ib = idxUmum.get(norm(b.mapel));
      if (ia != null && ib != null && ia !== ib) return ia - ib;
      return a.mapel.localeCompare(b.mapel, "id");
    });

    return rows;
  }, [data, nilaiKeys, namaUmumSet, capaianMap, idxUmum]);

  if (loading || loadingDs) return <p className="p-4 text-black">⏳ Memuat...</p>;
  if (!data) return <p className="p-4 text-red-600">❌ Data rapor tidak ditemukan.</p>;

  function formatNamaGelar(str) {
    if (!str) return "—";
    const parts = str.trim().split(" ");
    if (parts.length === 1) return str.toUpperCase();
    const gelar = parts.pop();
    const nama = parts.join(" ").toUpperCase();
    return `${nama} ${gelar}`;
  }

  const biodata = {
    nisn: data.nisn || "-",
    nama: data.nama_siswa || "-",
    kelas: data.kelas || "-",
    semester: data.semester || "-",
    tahun: data.tahun_pelajaran || "-",
    fase: data.fase || "",
  };

  // ⬇️ URL tanda tangan kepala sekolah (ambil dari beberapa kemungkinan field)
  const ttdKepalaSekolahUrl =
    bio?.kepala_sekolah_ttd || bio?.kepala_sekolah_foto || "";

  // ⬇️ Waktu pembagian rapor (ambil dari bio_sekolah)
  const waktuPembagianRaport =
    bio?.waktuPembagianRaport || "Jadwal belum ditentukan";

  // Komponen kecil untuk kop (dipakai di setiap halaman)
  const HeaderIdentitas = () => (
    <div
      className="leading-snug kop-print-only"
      style={{ fontSize: "11pt" }}
    >
      <div className="grid grid-cols-[1.3fr_1fr] gap-x-20">
        {/* Kolom kiri */}
        <div className="space-y-1">
          <div className="flex">
            <span className="w-36">Nama</span>
            <span className="w-4 text-center">:</span>
            <span className="font-bold">{biodata.nama}</span>
          </div>
          <div className="flex">
            <span className="w-36">NIS/NISN</span>
            <span className="w-4 text-center">:</span>
            <span>- / {biodata.nisn}</span>
          </div>
          <div className="flex">
            <span className="w-36">Nama Sekolah</span>
            <span className="w-4 text-center">:</span>
            <span className="whitespace-nowrap">{bio?.nama_sekolah || "—"}</span>
          </div>
          <div className="flex">
            <span className="w-36">Alamat</span>
            <span className="w-4 text-center">:</span>
            <span className="whitespace-nowrap">{bio?.alamat || "—"}</span>
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="space-y-1">
          <div className="flex">
            <span className="w-32">Kelas</span>
            <span className="w-4 text-center">:</span>
            <span className="font-bold">{biodata.kelas}</span>
          </div>
          <div className="flex">
            <span className="w-32">Semester</span>
            <span className="w-4 text-center">:</span>
            {/* khusus umum: ambil dari bio.semesterUmum */}
            <span>{bio?.semesterUmum || biodata.semester}</span>
          </div>
          <div className="flex">
            <span className="w-32">Fase</span>
            <span className="w-4 text-center">:</span>
            <span>{resolveFase(biodata.kelas, bio?.fase || biodata.fase)}</span>
          </div>
          <div className="flex">
            <span className="w-32">Tahun Pelajaran</span>
            <span className="w-4 text-center">:</span>
            {/* khusus umum: ambil dari bio.tahunPelajaranUmum */}
            <span>{bio?.tahunPelajaranUmum || biodata.tahun}</span>
          </div>
        </div>
      </div>

      {/* Garis pemisah penuh */}
      <div className="border-b border-black mt-2.5" />
    </div>
  );

  return (
    <div
      className="min-h-screen bg-white text-black pb-10"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* Wrapper responsif di layar, fix 210mm di print */}
      <div className="mx-auto w-full max-w-[210mm] px-2 print:w-[210mm] print:px-0">
        {/* ========= HALAMAN 1 ========= */}
        <div className="p-4 print:p-6 print:min-h-[297mm]">
          {/* Kop halaman 1 */}
          <HeaderIdentitas />

          {/* Judul */}
          <div className="judul-rapor text-center mt-8 mb-6 leading-none">
            <div className="font-semibold tracking-wide">
              LAPORAN HASIL BELAJAR
            </div>
            {/* <div className="font-semibold tracking-wide">
              SUMATIF AKHIR SEMESTER
            </div> */}
          </div>

          {/* Tabel nilai umum */}
          <div className="mt-2 overflow-x-auto print:overflow-visible">
            <table className="w-full border border-black border-collapse">
              <thead className="bg-purple-100 text-[11px] font-bold">
                <tr>
                  <th className="w-[32px] border border-black p-0 h-10 text-center align-middle">
                    No
                  </th>
                  <th className="w-[140] border border-black p-0 h-10 text-center align-middle">
                    Mata Pelajaran
                  </th>
                  <th className="w-[60] border border-black p-0 h-10 text-center align-middle">
                    Nilai Akhir
                  </th>
                  <th className="w-[370px] border border-black p-0 h-10 text-center align-middle">
                    Capaian Kompetensi
                  </th>
                </tr>
              </thead>
              <tbody className="text-[10px]">
                {rowsUmum.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-black p-0 text-center align-middle"
                    >
                      Tidak ada data (dataset kosong atau belum ada nilai/capaian).
                    </td>
                  </tr>
                ) : (
                  rowsUmum.map((r, i) => (
                    <tr key={r.mapel}>
                      <td className="border border-black p-0.5 text-center align-middle">
                        {i + 1}
                      </td>
                      <td className="border border-black p-0.5 text-left align-middle">
                        {fmt(r.mapel)}
                      </td>
                      <td className="border border-black p-0.5 text-center align-middle font-semibold">
                        {r.nilai}
                      </td>
                      <td className="border border-black p-0.5 text-left align-middle whitespace-pre-wrap break-words">
                        {r.capaian}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

  {/* TANDA TANGAN WALI KELAS — PRINT ONLY (SAMA TEMPLATE HALAMAN 2) */}
<div className="hidden print:block mt-10">
  <div className="overflow-x-auto print:overflow-visible">
    <table className="w-full text-[11px] leading-tight">
      <tbody>
        <tr>
          <td className="w-1/2" />
          <td className="w-1/2 align-top p-2 text-right">
            <div>{waktuPembagianRaport}</div>
            <div>Wali Kelas,</div>

            <div className="mt-16 inline-block text-left">
              <div className="font-bold underline">
                {formatNamaGelar(wali?.nama_wali)}
              </div>
              <div>NIP.</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

          {/* Ekstrakurikuler */}
          <div className="mt-3 overflow-x-auto print:overflow-visible page-break-before">
            <HeaderIdentitas />

          <div className="hidden print:block mt-8" />
            <table className="w-full border border-black border-collapse text-[11px]">
              <thead className="bg-purple-100 font-bold">
                <tr>
                  <th className="w-[32px] border border-black text-center">No</th>
                  <th className="w-[170] border border-black text-center">
                    Kegiatan Ekstrakurikuler
                  </th>
                  <th className="w-[100px] border border-black text-center">
                    Predikat
                  </th>
                  <th className="w-[300px] border border-black text-center">
                    Keterangan
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2].map((n) => (
                  <tr key={n}>
                    <td className="border border-black text-center p-1">{n}</td>
                    <td className="border border-black p-1">&nbsp;</td>
                    <td className="border border-black text-center p-1">&nbsp;</td>
                    <td className="border border-black p-1">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Absensi */}
          <div className="mt-3 grid grid-cols-1 gap-4">
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border border-black border-collapse mt-4">
                <thead className="bg-purple-100 text-[11px] font-bold">
                  <tr>
                    <th className="w-[100px] border border-black text-center align-middle">
                      Keterangan
                    </th>
                    <th className="w-[80px] border border-black text-center align-middle">
                      Jumlah Absensi
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[10px]">
                  <tr>
                    <td className="border border-black text-left p-1 whitespace-nowrap">
                      Sakit
                    </td>
                    <td className="border border-black text-center p-1">
                      {data.sakit || 0} hari
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black text-left p-1 whitespace-nowrap">
                      Izin
                    </td>
                    <td className="border border-black text-center p-1">
                      {data.izin || 0} hari
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black text-left p-1 whitespace-nowrap">
                      Tanpa Keterangan
                    </td>
                    <td className="border border-black text-center p-1">
                      {data.alpha || 0} hari
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Catatan wali kelas (akhir halaman 1) */}
          <div className="mt-4">
            <div className="font-bold mb-1 text-[11px]">Catatan Wali Kelas</div>
            <div className="border border-black p-2 text-[11px] leading-tight whitespace-pre-wrap break-words text-center">
              {data.catatan_wali && String(data.catatan_wali).trim() !== ""
                ? data.catatan_wali
                : "— (Belum ada catatan wali kelas)"}
            </div>
          </div>
        </div>

        {/* ========= HALAMAN 2 (TANDA TANGAN) ========= */}
        <div className="p-4 print:p-6 print:min-h-[297mm]">
          

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-[11px] leading-tight">
              <tbody>
                {/* Baris 1: Orang Tua/Wali | Wali Kelas */}
                <tr>
                  <td className="w-1/2 align-top p-2">
                    <div>Mengetahui</div>
                    <div>Orang Tua/Wali,</div>
                    <div className="mt-16">......................</div>
                  </td>

                  <td className="w-1/2 align-top p-2 text-right">
                    <div>{waktuPembagianRaport}</div>
                    <div>Wali Kelas,</div>
                    <div className="mt-16 inline-block text-left">
                      <div className="font-bold underline">
                        {formatNamaGelar(wali?.nama_wali)}
                      </div>
                      <div>NIP.</div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td colSpan={2} className="p-2 text-center align-top">
                    <div>Mengetahui</div>
                    <div>Kepala Sekolah</div>

                    {/* area tanda tangan */}
                    <div className="mt-3 inline-block text-center">
                      {ttdKepalaSekolahUrl && (
                        <div className="mb-0.5 flex justify-center">
                          <img
                            src={ttdKepalaSekolahUrl}
                            alt="Tanda tangan Kepala Sekolah"
                            className="h-16 w-40 object-contain"
                          />
                        </div>
                      )}

                      <div className="inline-block text-left">
  <div className="font-bold underline">
    {formatNamaGelar(bio?.kepala_sekolah)}
  </div>
  <div>NIP.</div>
</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Tombol Download (hide saat print) */}
        <div className="mt-3 px-4 print:hidden flex justify-center">
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-3 py-1.5 rounded text-[11px]"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
>>>>>>> a4197c0e3e5ac25b8f084d5bb75d699be91c54eb
