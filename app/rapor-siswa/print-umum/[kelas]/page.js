// app/cetak-rapor-umum-kelas/[kelas]/page.jsx
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
  "naik_kelas",
  "kelas_tujuan",
  "keterangan_naik_kelas",
];

const FASE_E_KELAS = [
  "10A1",
  "10A2",
  "10A3",
  "10A4",
  "10B1",
  "10B2",
  "10B3",
  "10B4",
];

function fmt(s) {
  return s && s.includes("_") ? s.replace(/_/g, " ") : s || "";
}

function formatNamaGelar(str) {
  if (!str) return "—";

  const parts = String(str).trim().split(" ");
  if (parts.length === 1) return String(str).toUpperCase();

  const gelar = parts.pop();
  const nama = parts.join(" ").toUpperCase();

  return `${nama} ${gelar}`;
}

function resolveFase(kelas, faseDb) {
  const raw = String(kelas || "").trim().toUpperCase();

  if (
    raw.startsWith("10") ||
    raw.startsWith("X") ||
    FASE_E_KELAS.includes(raw)
  ) {
    return "E";
  }

  return faseDb || "-";
}

function normalizeNilai(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "string") return v.trim();

  if (typeof v === "object") {
    if (v.nilai !== undefined) return v.nilai;
    if (v.value !== undefined) return v.value;

    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  return String(v);
}

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

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function safeKey(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/\//g, "_")
    .replace(/\./g, "_")
    .trim();
}

function looseKey(s) {
  return String(s || "")
    .replace(/_/g, " ")
    .replace(/\//g, " ")
    .replace(/\./g, " ")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function appliesToClass(docData, kelas) {
  const k = docData?.kelas;
  if (!kelas || !k) return false;

  if (Array.isArray(k)) {
    return k.map((x) => String(x).trim()).includes(String(kelas).trim());
  }

  const tokens = String(k)
    .split(/[^A-Za-z0-9]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return tokens.includes(String(kelas).trim());
}

function readFlat(raporObj, mapelName) {
  if (!raporObj) return undefined;

  const clean = String(mapelName || "").trim();
  const sk = safeKey(clean);
  const lk = looseKey(clean);

  if (raporObj[clean] !== undefined) return raporObj[clean];
  if (raporObj[sk] !== undefined) return raporObj[sk];

  const foundKey = Object.keys(raporObj).find((k) => {
    if (FIX_KEYS.includes(k) || k.startsWith("capaian_")) return false;
    return safeKey(k) === sk || looseKey(k) === lk;
  });

  return foundKey ? raporObj[foundKey] : undefined;
}

function readCapaian(raporObj, mapelName) {
  if (!raporObj) return undefined;

  const clean = String(mapelName || "").trim();
  const sk = safeKey(clean);
  const lk = looseKey(clean);
  const underscore = clean.replace(/\s+/g, "_");

  const candidates = [
    `${clean}_capaian`,
    `capaian_${clean}`,
    `${underscore}_capaian`,
    `capaian_${underscore}`,
    `${sk}_CAPAIAN`,
    `CAPAIAN_${sk}`,
    `${sk}_capaian`,
    `capaian_${sk}`,
  ];

  for (const key of candidates) {
    if (raporObj[key] !== undefined) return raporObj[key];
  }

  const foundKey = Object.keys(raporObj).find((k) => {
    const lower = String(k).toLowerCase();

    if (!lower.includes("capaian")) return false;

    const raw = lower.startsWith("capaian_")
      ? k.slice("capaian_".length)
      : lower.endsWith("_capaian")
        ? k.slice(0, -"_capaian".length)
        : k;

    return looseKey(raw) === lk || safeKey(raw) === sk;
  });

  return foundKey ? raporObj[foundKey] : undefined;
}

function getKelasAngka(kelas) {
  const raw = String(kelas || "").trim();
  const match = raw.match(/^(\d+)/);
  if (!match) return null;

  const angka = Number(match[1]);
  return Number.isFinite(angka) ? angka : null;
}

function isKelasAkhir(kelas) {
  const angka = getKelasAngka(kelas);
  return angka !== null && angka >= 12;
}

function getKelasTujuan(kelas) {
  const raw = String(kelas || "").trim();
  if (!raw) return "-";

  const match = raw.match(/^(\d+)(.*)$/);
  if (!match) return raw;

  const angka = Number(match[1]);
  const sisa = match[2] || "";

  if (!Number.isFinite(angka)) return raw;

  return `${angka + 1}${sisa}`;
}

function getKeteranganNaikKelas(data) {
  const kelasSekarang = String(data?.kelas || "-").trim();

  if (isKelasAkhir(kelasSekarang)) {
    return "";
  }

  const naikKelas = data?.naik_kelas !== false;
  const kelasTujuan =
    data?.kelas_tujuan && String(data.kelas_tujuan).trim() !== ""
      ? String(data.kelas_tujuan).trim()
      : getKelasTujuan(kelasSekarang);

  if (
    data?.keterangan_naik_kelas &&
    String(data.keterangan_naik_kelas).trim() !== ""
  ) {
    return String(data.keterangan_naik_kelas).trim();
  }

  if (!naikKelas) {
    return `Tidak naik kelas dan tetap di kelas ${kelasSekarang}`;
  }

  return `Naik kelas ke kelas ${kelasTujuan}`;
}

function computeRowsUmum(data, mapelUmum) {
  if (!data?.kelas) return { rowsUmum: [], biodata: {} };

  const seen = new Set();

  const rows = (Array.isArray(mapelUmum) ? mapelUmum : [])
    .filter((m) => appliesToClass(m, data.kelas))
    .filter((m) => {
      const key = looseKey(m.nama || m.title || m.label);
      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .map((m, index) => {
      const namaMapel = String(m.nama || m.title || m.label || "").trim();
      const nilai = normalizeNilai(readFlat(data, namaMapel));
      const capaian = normalizeCapaian(readCapaian(data, namaMapel));

      return {
        mapel: namaMapel,
        nilai,
        capaian,
        order: index,
      };
    })
    .filter((r) => hasValue(r.nilai) && hasValue(r.capaian));

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

function HeaderIdentitas({ biodata, bio }) {
  return (
    <div
      className="leading-snug"
      style={{ fontSize: "11pt", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="grid grid-cols-[1.3fr_1fr] gap-x-20">
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
            <span>{resolveFase(biodata.kelas, bio?.fase || biodata.fase)}</span>
          </div>
          <div className="flex">
            <span className="w-32">Tahun Pelajaran</span>
            <span className="w-4 text-center">:</span>
            <span>{bio?.tahunPelajaranUmum || biodata.tahun || "-"}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-black mt-2.5" />
    </div>
  );
}

function SheetUmum({ rapor, wali, bio, mapelUmum }) {
  const { rowsUmum, biodata } = useMemo(
    () => computeRowsUmum(rapor, mapelUmum),
    [rapor, mapelUmum]
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
      <HeaderIdentitas biodata={biodata} bio={bio} />

      <div className="judul-rapor text-center mt-8 mb-6 leading-none">
        <div className="font-semibold tracking-wide">LAPORAN HASIL BELAJAR</div>
      </div>

      <table className="w-full border border-black border-collapse">
        <thead className="bg-purple-100 text-[11px] font-bold">
          <tr>
            <th className="w-[32px] border border-black p-0 h-10 text-center align-middle">
              No
            </th>
            <th className="w-[140px] border border-black p-0 h-10 text-center align-middle">
              Mata Pelajaran
            </th>
            <th className="w-[60px] border border-black p-0 h-10 text-center align-middle">
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
                Tidak ada data mapel umum untuk kelas ini atau nilai/capaian
                belum lengkap.
              </td>
            </tr>
          ) : (
            rowsUmum.map((r, i) => (
              <tr key={`${r.mapel}-${i}`}>
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

      <div className="hidden print:block print:break-before-page mt-6" />

      <div className="hidden print:block mb-6">
        <HeaderIdentitas biodata={biodata} bio={bio} />
      </div>

      <div className="mt-3">
        <table className="w-full border border-black border-collapse text-[11px]">
          <thead className="bg-purple-100 font-bold">
            <tr>
              <th className="w-[32px] border border-black text-center">No</th>
              <th className="w-[170px] border border-black text-center">
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

      {!isKelasAkhir(rapor.kelas) && (
        <div className="mt-4">
          <div className="font-bold mb-1 text-[11px]">Keterangan</div>
          <div className="border border-black p-2 text-[11px] leading-tight whitespace-pre-wrap break-words text-center">
            {getKeteranganNaikKelas(rapor)}
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="font-bold mb-1 text-[11px]">Catatan Wali Kelas</div>
        <div className="border border-black p-2 text-[11px] leading-tight whitespace-pre-wrap break-words text-center">
          {rapor.catatan_wali && String(rapor.catatan_wali).trim() !== ""
            ? rapor.catatan_wali
            : "— (Belum ada catatan wali kelas)"}
        </div>
      </div>

      <table className="w-full text-[11px] leading-tight mt-8">
        <tbody>
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

export default function PrintUmumKelas() {
  const { kelas } = useParams();

  const [siswa, setSiswa] = useState([]);
  const [raporByNisn, setRaporByNisn] = useState({});
  const [bio, setBio] = useState(null);
  const [wali, setWali] = useState(null);
  const [mapelUmum, setMapelUmum] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      try {
        let mapelSnap;

        try {
          mapelSnap = await getDocs(
            query(collection(db, "mapel_umum"), orderBy("createdAt", "asc"))
          );
        } catch {
          mapelSnap = await getDocs(collection(db, "mapel_umum"));
        }

        const mapelArr = mapelSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }));

        setMapelUmum(mapelArr);

        const sSnap = await getDocs(collection(db, "siswa"));
        const allS = sSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        const list = allS.filter((s) => s.kelas === kelas);

        const rSnap = await getDocs(collection(db, "raport"));
        const rMap = {};

        rSnap.docs.forEach((d) => {
          const r = d.data() || {};
          if (r.nisn) rMap[r.nisn] = r;
        });

        try {
          const wSnap = await getDocs(
            query(collection(db, "wali_kelas"), where("kelas", "==", kelas))
          );

          if (!wSnap.empty) setWali(wSnap.docs[0].data());
        } catch {}

        try {
          const bioDoc = await getDoc(doc(db, "bio_sekolah", "default"));
          if (bioDoc.exists()) setBio(bioDoc.data());
        } catch {}

        setSiswa(list);
        setRaporByNisn(rMap);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [kelas]);

  return (
    <div className="min-h-screen bg-white text-black scroll-hide">
      <style>{`
        .scroll-hide {
          overflow: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scroll-hide::-webkit-scrollbar {
          display: none;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .scroll-hide {
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 p-3 flex items-center gap-3">
        <div className="font-semibold">Print Rapor Umum — Kelas {kelas}</div>

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
            if (!r) return null;

            return (
              <SheetUmum
                key={s.nisn}
                rapor={r}
                wali={wali}
                bio={bio}
                mapelUmum={mapelUmum}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}