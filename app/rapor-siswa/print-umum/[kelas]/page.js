"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/** ====== Konstanta & helper ====== */
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

const fmt = (s) => (s?.includes("_") ? s.replace(/_/g, " ") : s);

/** Uppercase nama + gelar jadi "NAMA GELAR" */
function formatNamaGelar(str) {
  if (!str) return "—";
  const parts = String(str).trim().split(" ");
  if (parts.length === 1) return str.toUpperCase();
  const gelar = parts.pop();
  const nama = parts.join(" ").toUpperCase();
  return `${nama} ${gelar}`;
}

/** Normalisasi nama mapel/capaian untuk pencocokan kunci */
function canonName(x) {
  return String(x || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // buang isi dalam kurung: (Umum)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ambil nilai dari berbagai bentuk */
function normalizeNilai(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") {
    // dukung { nilai }, { value }, atau angka/string apapun
    if (v.nilai !== undefined) return v.nilai;
    if (v.value !== undefined) return v.value;
    // fallback stringify ringkas
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Ambil teks capaian dari berbagai bentuk */
function normalizeCapaian(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    if (v.deskripsi) return String(v.deskripsi);
    if (v.teks) return String(v.teks);
    if (v.text) return String(v.text);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Bentuk baris nilai + capaian berbasis dataset_mapel_umum */
function computeRowsUmum(data, datasetUmum) {
  if (!data) return { rowsUmum: [], biodata: {} };

  const allKeys = Object.keys(data);

  // 1) Peta CAPAIAN: capaian_*  -> by canonical key
  const capaianMap = {};
  for (const k of allKeys) {
    if (k.startsWith("capaian_")) {
      // contoh k = "capaian_bahasa indonesia" atau "capaian_bahasa_indonesia"
      const raw = k.slice("capaian_".length);
      const cKey = canonName(raw);
      capaianMap[cKey] = data[k];
    }
  }

  // 2) Peta NILAI by canonical key (semua key selain FIX & capaian_*)
  const nilaiMap = {};
  for (const k of allKeys) {
    if (FIX_KEYS.includes(k)) continue;
    if (k.startsWith("capaian_")) continue;
    const cKey = canonName(k);
    nilaiMap[cKey] = data[k];
  }

  // 3) Urutan berdasarkan dataset_mapel_umum (nama field "nama")
  const dataset = Array.isArray(datasetUmum) ? datasetUmum : [];
  const idxUmum = new Map(
    dataset.map((d, i) => [canonName(d.nama || d.title || d.label || ""), i])
  );

  const hasValue = (v) =>
    v !== null && v !== undefined && String(v).trim() !== "";

  // 4) Bangun baris: iterasi atas dataset supaya urutannya konsisten
  const rows = [];
  for (const d of dataset) {
    const namaAsli = d?.nama || d?.title || d?.label || "";
    const key = canonName(namaAsli);
    if (!key) continue;

    const nilaiRaw =
      nilaiMap[key] ??
      nilaiMap[key.replace(/ /g, "_")] ??
      nilaiMap[key.replace(/ /g, "")];

    const capaianRaw =
      capaianMap[key] ??
      capaianMap[key.replace(/ /g, "_")] ??
      capaianMap[key.replace(/ /g, "")];

    const nilai = normalizeNilai(nilaiRaw);
    const capaian = normalizeCapaian(capaianRaw);

    if (hasValue(nilai) && hasValue(capaian)) {
      rows.push({
        mapel: namaAsli, // tampilkan sesuai dataset
        nilai,
        capaian,
        _order: idxUmum.get(key) ?? 999,
      });
    }
  }

  rows.sort((a, b) => a._order - b._order);

  return {
    rowsUmum: rows,
    biodata: {
      nisn: data.nisn || "-",
      nama: data.nama_siswa || "-",
      kelas: data.kelas || "-",
      semester: data.semester || "-",
      tahun: data.tahun_pelajaran || "-",
      fase: data.fase || "",
    },
  };
}

/** ====== Komponen sheet satu siswa (layout ≈ cetak-umum satu-persatu) ====== */
function SheetUmum({ rapor, wali, bio, datasetUmum }) {
  const { rowsUmum, biodata } = useMemo(
    () => computeRowsUmum(rapor, datasetUmum),
    [rapor, datasetUmum]
  );

  const ttdKepalaSekolahUrl =
    bio?.kepala_sekolah_ttd || bio?.kepala_sekolah_foto || "";
  const waktuPembagianRaport =
    bio?.waktuPembagianRaport || "Jadwal belum ditentukan";

  return (
    <div
      className="mx-auto w-[210mm] min-h-[297mm] bg-white text-black p-4 print:p-6 print:break-after-page last:print:break-after-auto"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* HEADER IDENTITAS – sama dengan cetak-umum satu siswa */}
      <div
        className="leading-snug"
        style={{ fontSize: "11pt", fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div className="grid grid-cols-[1.3fr_1fr] gap-x-20">
          {/* kiri */}
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
              <span className="whitespace-nowrap">
                {bio?.nama_sekolah || "—"}
              </span>
            </div>
            <div className="flex">
              <span className="w-36">Alamat</span>
              <span className="w-4 text-center">:</span>
              <span className="whitespace-nowrap">{bio?.alamat || "—"}</span>
            </div>
          </div>
          {/* kanan */}
          <div className="space-y-1">
            <div className="flex">
              <span className="w-32">Kelas</span>
              <span className="w-4 text-center">:</span>
              <span className="font-bold">{biodata.kelas}</span>
            </div>
            <div className="flex">
              <span className="w-32">Semester</span>
              <span className="w-4 text-center">:</span>
              <span>{bio?.semesterUmum || biodata.semester || "-"}</span>
            </div>
            <div className="flex">
              <span className="w-32">Fase</span>
              <span className="w-4 text-center">:</span>
              <span>{bio?.fase || biodata.fase || "-"}</span>
            </div>
            <div className="flex">
              <span className="w-32">Tahun Pelajaran</span>
              <span className="w-4 text-center">:</span>
              <span>
                {bio?.tahunPelajaranUmum || biodata.tahun || "-"}
              </span>
            </div>
          </div>
        </div>
        <div className="border-b border-black mt-2.5" />
      </div>

      {/* JUDUL – sama dengan cetak-umum (satu baris) */}
      <div className="judul-rapor text-center mt-8 mb-6 leading-none">
        <div className="font-semibold tracking-wide">LAPORAN HASIL BELAJAR</div>
        {/* baris kedua disembunyikan seperti di page cetak satu siswa */}
        {/* <div className="font-semibold tracking-wide">
          SUMATIF AKHIR SEMESTER
        </div> */}
      </div>

      {/* TABEL NILAI UMUM */}
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

      {/* TANDA TANGAN WALI KELAS — PRINT ONLY (SETELAH TABEL NILAI) */}
<div className="hidden print:block mt-10">
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


      {/* PAGE BREAK: mulai halaman kedua */}
<div className="hidden print:block print:break-before-page mt-6" />
        {/* Kop halaman 2: hanya muncul saat print */}
        <div
          className="hidden print:block leading-snug mb-6"
          style={{
            fontSize: "11pt",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <div className="grid grid-cols-[1.3fr_1fr] gap-x-20">
            {/* kiri */}
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
                <span className="whitespace-nowrap">
                  {bio?.nama_sekolah || "—"}
                </span>
              </div>
              <div className="flex">
                <span className="w-36">Alamat</span>
                <span className="w-4 text-center">:</span>
                <span className="whitespace-nowrap">
                  {bio?.alamat || "—"}
                </span>
              </div>
            </div>

            {/* kanan */}
            <div className="space-y-1">
              <div className="flex">
                <span className="w-32">Kelas</span>
                <span className="w-4 text-center">:</span>
                <span className="font-bold">{biodata.kelas}</span>
              </div>
              <div className="flex">
                <span className="w-32">Semester</span>
                <span className="w-4 text-center">:</span>
                <span>{bio?.semesterUmum || biodata.semester || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-32">Fase</span>
                <span className="w-4 text-center">:</span>
                <span>{bio?.fase || biodata.fase || "-"}</span>
              </div>
              <div className="flex">
                <span className="w-32">Tahun Pelajaran</span>
                <span className="w-4 text-center">:</span>
                <span>
                  {bio?.tahunPelajaranUmum || biodata.tahun || "-"}
                </span>
              </div>
            </div>
          </div>
          <div className="border-b border-black mt-2.5" />
        </div>

      {/* EKSTRAKURIKULER – sama dengan single-page (2 baris kosong) */}
      <div className="mt-3">
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

      {/* ABSENSI – sama dengan single */}
      <div className="mt-3 grid grid-cols-1 gap-4">
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
                {rapor.sakit || 0} hari
              </td>
            </tr>
            <tr>
              <td className="border border-black text-left p-1 whitespace-nowrap">
                Izin
              </td>
              <td className="border border-black text-center p-1">
                {rapor.izin || 0} hari
              </td>
            </tr>
            <tr>
              <td className="border border-black text-left p-1 whitespace-nowrap">
                Tanpa Keterangan
              </td>
              <td className="border border-black text-center p-1">
                {rapor.alpha || 0} hari
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* CATATAN WALI KELAS – tekstual sama dengan single */}
      <div className="mt-4">
        <div className="font-bold mb-1 text-[11px]">Catatan Wali Kelas</div>
        <div className="border border-black p-2 text-[11px] leading-tight whitespace-pre-wrap break-words text-center">
          {rapor.catatan_wali && String(rapor.catatan_wali).trim() !== ""
            ? rapor.catatan_wali
            : "— (Belum ada catatan wali kelas)"}
        </div>
      </div>

           
     

        {/* Tabel tanda tangan (muncul di layar & print) */}
        <table className="w-full text-[11px] leading-tight mt-8">
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

            {/* Baris 2: Kepala Sekolah */}
            <tr>
              <td colSpan={2} className="p-2 text-center align-top">
                <div>Mengetahui</div>
                <div>Kepala Sekolah</div>

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
  );
}

/** ====== Halaman print-all (tanpa iframe) ====== */
export default function PrintUmumKelas() {
  const { kelas } = useParams();
  const [siswa, setSiswa] = useState([]);
  const [raporByNisn, setRaporByNisn] = useState({});
  const [bio, setBio] = useState(null);
  const [wali, setWali] = useState(null);
  const [datasetUmum, setDatasetUmum] = useState([]); // ← ambil dari Firestore
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 0) dataset mapel umum (diurutkan createdAt jika ada)
      try {
        let snap;
        try {
          snap = await getDocs(
            query(
              collection(db, "dataset_mapel_umum"),
              orderBy("createdAt", "asc")
            )
          );
        } catch {
          // fallback tanpa index/orderBy
          snap = await getDocs(collection(db, "dataset_mapel_umum"));
        }
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setDatasetUmum(arr);
      } catch {
        setDatasetUmum([]); // tetap aman
      }

      // 1) siswa per kelas
      const sSnap = await getDocs(collection(db, "siswa"));
      const allS = sSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const list = allS.filter((s) => s.kelas === kelas);

      // 2) rapor untuk nisn yang ada (sederhana: load semua lalu dipetakan)
      const rSnap = await getDocs(collection(db, "raport"));
      const rMap = {};
      rSnap.docs.forEach((d) => {
        const r = d.data() || {};
        if (r.nisn) rMap[r.nisn] = r;
      });

      // 3) wali_kelas kelas ini
      try {
        const wSnap = await getDocs(
          query(collection(db, "wali_kelas"), where("kelas", "==", kelas))
        );
        if (!wSnap.empty) setWali(wSnap.docs[0].data());
      } catch {}

      // 4) bio sekolah
      try {
        const bioDoc = await getDoc(doc(db, "bio_sekolah", "default"));
        if (bioDoc.exists()) setBio(bioDoc.data());
      } catch {}

      setSiswa(list);
      setRaporByNisn(rMap);
      setLoading(false);
    })();
  }, [kelas]);

  return (
    <div className="min-h-screen bg-white text-black scroll-hide">
      <style>{`
        /* sembunyikan scrollbar visual */
        .scroll-hide { overflow: auto; -ms-overflow-style: none; scrollbar-width: none; }
        .scroll-hide::-webkit-scrollbar { display: none; }
        @media print {
          .no-print { display: none !important; }
          .scroll-hide { overflow: visible !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 p-3 flex items-center gap-3">
        <div className="font-semibold">
          Print Rapor Umum — Kelas {kelas}
        </div>
        <div className="ml-auto text-sm text-slate-500">
          Total siswa: {loading ? "…" : siswa.length}
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
        >
          Print → PDF
        </button>
      </div>

      {loading ? (
        <div className="p-6">⏳ Memuat data…</div>
      ) : siswa.length === 0 ? (
        <div className="p-6">Tidak ada siswa untuk kelas ini.</div>
      ) : (
        <div className="mx-auto max-w-[210mm]">
          {siswa.map((s) => {
            const r = raporByNisn[s.nisn];
            if (!r) return null; // belum ada rapor
            return (
              <SheetUmum
                key={s.nisn}
                rapor={r}
                wali={wali}
                bio={bio}
                datasetUmum={datasetUmum}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
