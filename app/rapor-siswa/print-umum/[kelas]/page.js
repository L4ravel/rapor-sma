"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/** ====== Konstanta & helper yang sama dengan cetak individual ====== */
const MAPEL_UMUM = [
  "Pendidikan Agama Islam dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika (Umum)",
  "Ilmu Pengetahuan Alam (IPA)",
  "Ilmu Pengetahuan Sosial (IPS)",
  "Bahasa Inggris",
  "Pendidikan Jasmani, Olahraga, dan Kesehatan",
  "Informatika",
  "Seni dan Budaya",
  "Muatan Lokal",
];
const FIX_KEYS = ["nisn", "nama_siswa", "kelas", "semester", "tahun_pelajaran", "sakit", "izin", "alpha", "fase"];

const fmt = (s) => (s?.includes("_") ? s.replace(/_/g, " ") : s);

function formatNamaGelar(str) {
  if (!str) return "—";
  const parts = str.trim().split(" ");
  if (parts.length === 1) return str.toUpperCase(); // hanya nama
  const gelar = parts.pop(); // kata terakhir
  const nama = parts.join(" ").toUpperCase();
  return `${nama} ${gelar}`; // contoh: ZIYA SAFRONI S.Pd
}

/** Bentuk baris nilai + capaian seperti di halaman individual */
function computeRowsUmum(data) {
  if (!data) return { rowsUmum: [], biodata: {} };

  const allKeys = Object.keys(data);
  const capaianMap = {};
  for (const k of allKeys) {
    if (k.startsWith("capaian_")) {
      const nama = k.slice("capaian_".length);
      capaianMap[nama] = data[k];
    }
  }

  const nilaiKeys = allKeys.filter((k) => !FIX_KEYS.includes(k) && !k.startsWith("capaian_"));
  const isUmum = (k) => MAPEL_UMUM.some((u) => u.toLowerCase() === k.toLowerCase());
  const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== "";
  const norm = (s) => String(s).toLowerCase().replace(/_/g, " ").trim();
  const orderIndex = (name) => {
    const i = MAPEL_UMUM.findIndex((m) => norm(m) === norm(name));
    return i === -1 ? 999 : i;
  };

  const rows = nilaiKeys
    .filter(isUmum)
    .map((k) => ({
      mapel: k,
      nilai: data[k],
      capaian: capaianMap[k] || capaianMap[k.replace(/_/g, " ")] || "",
    }))
    .filter((r) => hasValue(r.nilai) && hasValue(r.capaian))
    .sort((a, b) => orderIndex(a.mapel) - orderIndex(b.mapel));

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

/** ====== Komponen sheet satu siswa (layout = cetak-umum) ====== */
function SheetUmum({ rapor, wali, bio }) {
  const { rowsUmum, biodata } = useMemo(() => computeRowsUmum(rapor), [rapor]);

  return (
    <div className="mx-auto w-[210mm] min-h-[297mm] bg-white text-black p-4 print:p-6 print:break-after-page last:print:break-after-auto"
         style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* HEADER IDENTITAS */}
      <div className="leading-snug" style={{ fontSize: "11pt", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div className="grid grid-cols-[1.3fr_1fr] gap-x-20">
          {/* kiri */}
          <div className="space-y-1">
            <div className="flex"><span className="w-36">Nama</span><span className="w-4 text-center">:</span><span className="font-bold">{biodata.nama}</span></div>
            <div className="flex"><span className="w-36">NIS/NISN</span><span className="w-4 text-center">:</span><span>- / {biodata.nisn}</span></div>
            <div className="flex"><span className="w-36">Nama Sekolah</span><span className="w-4 text-center">:</span><span className="whitespace-nowrap">{bio?.nama_sekolah || "—"}</span></div>
            <div className="flex"><span className="w-36">Alamat</span><span className="w-4 text-center">:</span><span className="whitespace-nowrap">{bio?.alamat || "—"}</span></div>
          </div>
          {/* kanan */}
          <div className="space-y-1">
            <div className="flex"><span className="w-32">Kelas</span><span className="w-4 text-center">:</span><span className="font-bold">{biodata.kelas}</span></div>
            <div className="flex"><span className="w-32">Fase</span><span className="w-4 text-center">:</span><span>{bio?.fase || "—"}</span></div>
            <div className="flex"><span className="w-32">Semester</span><span className="w-4 text-center">:</span><span>{biodata.semester}</span></div>
            <div className="flex"><span className="w-32">Tahun Pelajaran</span><span className="w-4 text-center">:</span><span>{biodata.tahun}</span></div>
          </div>
        </div>
        <div className="border-b border-black mt-2.5" />
      </div>

      {/* JUDUL */}
      <h1 className="text-center font-semibold text-[14px] tracking-wide mt-8 mb-6">
        LAPORAN HASIL BELAJAR
      </h1>

      {/* TABEL NILAI UMUM */}
      <table className="w-full border border-black border-collapse">
        <thead className="bg-purple-100 text-[11px] font-bold">
          <tr>
            <th className="w-[32px] border border-black p-0 h-10 text-center align-middle">No</th>
            <th className="w-[140] border border-black p-0 h-10 text-center align-middle">Mata Pelajaran</th>
            <th className="w-[60] border border-black p-0 h-10 text-center align-middle">Nilai Akhir</th>
            <th className="w-[370px] border border-black p-0 h-10 text-center align-middle">Capaian Kompetensi</th>
          </tr>
        </thead>
        <tbody className="text-[10px]">
          {rowsUmum.length === 0 ? (
            <tr><td colSpan={4} className="border border-black p-0 text-center align-middle">Tidak ada data.</td></tr>
          ) : rowsUmum.map((r, i) => (
            <tr key={r.mapel}>
              <td className="border border-black p-0.5 text-center align-middle">{i + 1}</td>
              <td className="border border-black p-0.5 text-left align-middle">{fmt(r.mapel)}</td>
              <td className="border border-black p-0.5 text-center align-middle font-semibold">{r.nilai}</td>
              <td className="border border-black p-0.5 text-left align-middle whitespace-pre-wrap break-words">{r.capaian}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* EKSTRAKURIKULER (placeholder) */}
      <div className="mt-3">
        <table className="w-full border border-black border-collapse text-[11px]">
          <thead className="bg-purple-100 font-bold">
            <tr>
              <th className="w-[32px] border border-black text-center">No</th>
              <th className="w-[170] border border-black text-center">Kegiatan Ekstrakurikuler</th>
              <th className="w-[100px] border border-black text-center">Predikat</th>
              <th className="w-[300px] border border-black text-center">Keterangan</th>
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

      {/* ABSENSI */}
      <div className="mt-3 grid grid-cols-2 gap-4">
        <table className="w-full border border-black border-collapse mt-4">
          <thead className="bg-purple-100 text-[11px] font-bold">
            <tr>
              <th className="w-[100px] border border-black text-center align-middle">Keterangan</th>
              <th className="w-[80px] border border-black text-center align-middle">Jumlah Absensi</th>
            </tr>
          </thead>
          <tbody className="text-[10px]">
            <tr><td className="border border-black text-left p-1 whitespace-nowrap">Sakit</td><td className="border border-black text-center p-1">{rapor.sakit || 0} hari</td></tr>
            <tr><td className="border border-black text-left p-1 whitespace-nowrap">Izin</td><td className="border border-black text-center p-1">{rapor.izin || 0} hari</td></tr>
            <tr><td className="border border-black text-left p-1 whitespace-nowrap">Tanpa Keterangan</td><td className="border border-black text-center p-1">{rapor.alpha || 0} hari</td></tr>
          </tbody>
        </table>
      </div>

      {/* CATATAN WALI KELAS */}
      <div className="mt-4">
        <div className="font-bold mb-1 text-[11px]">Catatan Wali Kelas</div>
        <div className="border border-black p-2 text-[11px] leading-tight whitespace-pre-wrap break-words text-center">
          {rapor.catatan_wali && String(rapor.catatan_wali).trim() !== "" ? rapor.catatan_wali : "— (Belum ada catatan wali kelas)"}
        </div>
      </div>

      {/* TANDA TANGAN (SAMA seperti individual) */}
      <div className="mt-10 print:break-before-page">
        <table className="w-full text-[11px] leading-tight">
          <tbody>
            <tr>
              <td className="w-1/2 align-top p-2">
                <div>Mengetahui</div>
                <div>Orang Tua/Wali,</div>
                <div className="mt-16">......................</div>
              </td>
              <td className="w-1/2 align-top p-2 text-right">
                <div>Bagek Nyaka, 1 Oktober 2025</div>
                <div>Wali Kelas,</div>
                <div className="mt-16 inline-block text-left">
                  <div className="font-bold underline">{formatNamaGelar(wali?.nama_wali)}</div>
                  <div>NIP.</div>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="p-2 text-center align-top">
                <div>Mengetahui</div>
                <div>Kepala Sekolah</div>
                <div className="mt-16 inline-block text-center">
                  <div className="font-bold underline">{formatNamaGelar(bio?.kepala_sekolah)}</div>
                  <div className="text-left">NIP.</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) siswa per kelas
      const sSnap = await getDocs(collection(db, "siswa"));
      const allS = sSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const list = allS.filter((s) => s.kelas === kelas);

      // 2) rapor untuk nisn yang ada
      const rSnap = await getDocs(collection(db, "raport"));
      const rMap = {};
      rSnap.docs.forEach((d) => {
        const r = d.data() || {};
        if (r.nisn) rMap[r.nisn] = r;
      });

      // 3) wali_kelas kelas ini
      try {
        const wSnap = await getDocs(query(collection(db, "wali_kelas"), where("kelas", "==", kelas)));
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
    <div className="min-h-screen bg-slate-50 text-black scroll-hide">
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
        <div className="font-semibold">Print Rapor Umum — Kelas {kelas}</div>
        <div className="ml-auto text-sm text-slate-500">Total siswa: {loading ? "…" : siswa.length}</div>
        <button onClick={() => window.print()} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
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
            return <SheetUmum key={s.nisn} rapor={r} wali={wali} bio={bio} />;
          })}
        </div>
      )}
    </div>
  );
}
