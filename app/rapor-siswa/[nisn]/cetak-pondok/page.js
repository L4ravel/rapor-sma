"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ===================== Util & Konstanta ===================== */

// Mapel UMUM dipakai untuk memisahkan kunci nilai umum (agar fokus pondok)
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
  "createdAt",
  "updatedAt",
];

const safeKey = (name) =>
  String(name || "")
    .toUpperCase()
    .replace(/\//g, "_")
    .replace(/\./g, "_")
    .trim();

// Normalisasi nilai → angka murni (untuk total/rata2)
function normalizeToNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return isNaN(n) ? NaN : n;
  }
  if (typeof v === "object") {
    if (v.nilai != null) return normalizeToNumber(v.nilai);
    if (v.value != null) return normalizeToNumber(v.value);
  }
  return NaN;
}

/** Terbilang Indonesia sederhana untuk 0..100 */
function terbilangID(n) {
  const angka = [
    "Nol",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];
  if (isNaN(n)) return "";
  if (n < 0) return "";
  if (n <= 11) return angka[n];
  if (n < 20) return angka[n - 10] + " Belas";
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    return angka[puluh] + " Puluh" + (sisa ? " " + angka[sisa] : "");
  }
  if (n === 100) return "Seratus";
  return String(n);
}

/** Digit Latin → Arab Timur */
function toArabicDigits(input) {
  const map = {
    "0": "٠",
    "1": "١",
    "2": "٢",
    "3": "٣",
    "4": "٤",
    "5": "٥",
    "6": "٦",
    "7": "٧",
    "8": "٨",
    "9": "٩",
    A: "أ",
    B: "ب",
  };

  return String(input).replace(/[0-9AB]/g, (ch) => map[ch] || ch);
}

/** Terbilang Arab sederhana 0..100 */
function terbilangAR(n) {
  if (isNaN(n) || n < 0 || n > 100) return "";
  const upTo10 = [
    "صفر",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
    "عشرة",
  ];
  if (n <= 10) return upTo10[n];
  if (n === 11) return "أحد عشر";
  if (n === 12) return "اثنا عشر";
  if (n > 12 && n < 20) return upTo10[n - 10] + " عشر";
  const tensMap = {
    20: "عشرون",
    30: "ثلاثون",
    40: "أربعون",
    50: "خمسون",
    60: "ستون",
    70: "سبعون",
    80: "ثمانون",
    90: "تسعون",
    100: "مائة",
  };
  if (n % 10 === 0) return tensMap[n] || "";
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const unit = n % 10;
    return `${upTo10[unit]} و${tensMap[tens]}`;
  }
  return "";
}

/** Nama: kapital + gelar dipertahankan */
function formatNamaGelar(str) {
  if (!str) return "—";
  const parts = String(str).trim().split(" ");
  if (parts.length === 1) return parts[0].toUpperCase();
  const gelar = parts.pop();
  const nama = parts.join(" ").toUpperCase();
  return `${nama} ${gelar}`;
}

export default function CetakRaporPondok() {
  const params = useParams();
  const nisnParam = params?.nisn ? String(params.nisn) : "";
  const [rapor, setRapor] = useState(null);
  const [datasetPondok, setDatasetPondok] = useState([]); // [{nama, arab?}]
  const [loading, setLoading] = useState(true);
  const [namaArab, setNamaArab] = useState("");

  // Bio sekolah & Wali Kelas
  const [bio, setBio] = useState(null);
  const [wali, setWali] = useState(null);

  /* ===================== Fetching ===================== */

  // data siswa (nama arab)
  useEffect(() => {
    const run = async () => {
      if (!nisnParam) return;
      try {
        const s = await getDoc(doc(db, "siswa", String(nisnParam)));
        if (s.exists()) {
          const d = s.data() || {};
          setNamaArab((d.nama_ar || "").toString().trim());
        }
      } catch (e) {
        console.error("Gagal ambil siswa/{nisn}:", e);
      }
    };
    run();
  }, [nisnParam]);

  // rapor by nisn
  useEffect(() => {
    const run = async () => {
      try {
        if (!nisnParam) return;
        const q = query(
          collection(db, "raport"),
          where("nisn", "==", nisnParam)
        );
        const snap = await getDocs(q);
        if (!snap.empty) setRapor(snap.docs[0].data());
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [nisnParam]);

  // dataset mapel pondok
  useEffect(() => {
    const run = async () => {
      try {
        let snap;
        try {
          snap = await getDocs(
            query(
              collection(db, "dataset_mapel_pondok"),
              orderBy("createdAt", "asc")
            )
          );
        } catch {
          snap = await getDocs(collection(db, "dataset_mapel_pondok"));
        }
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return { nama: data.nama || "", arab: data.arab || "" };
        });
        setDatasetPondok(list);
      } catch (e) {
        console.error("Gagal ambil dataset_mapel_pondok", e);
      }
    };
    run();
  }, []);

  // bio sekolah
  useEffect(() => {
    const loadBio = async () => {
      try {
        const s = await getDoc(doc(db, "bio_sekolah", "default"));
        if (s.exists()) setBio(s.data());
      } catch (e) {
        console.error("Gagal ambil bio sekolah", e);
      }
    };
    loadBio();
  }, []);

  // wali kelas
  useEffect(() => {
    const run = async () => {
      try {
        if (!rapor?.kelas) return;
        const qW = query(
          collection(db, "wali_kelas"),
          where("kelas", "==", rapor.kelas)
        );
        const s = await getDocs(qW);
        if (!s.empty) setWali(s.docs[0].data());
      } catch (e) {
        console.error("Gagal ambil wali_kelas", e);
      }
    };
    run();
  }, [rapor?.kelas]);

  /* ===================== Derivasi Data ===================== */

const { biodata, rowsPondok } = useMemo(() => {
  if (!rapor) return { biodata: {}, rowsPondok: [] };

  // index dataset untuk ordering
  const idxPondok = new Map();
  datasetPondok.forEach((d, i) =>
    idxPondok.set(String(d.nama || "").toLowerCase(), i)
  );

  // Untuk setiap mapel di dataset_mapel_pondok (urutan natural dataset),
  // cari nilai di beberapa tempat:
  // 1) nested: rapor.pondok[orig]?.nilai  OR rapor.pondok[safe]?.nilai
  // 2) flat: rapor[orig] OR rapor[safe]
  const rows = (datasetPondok || [])
    .map((d) => {
      const orig = d.nama || "";
      const sk = safeKey(orig);

      let rawVal;

      // nested pondok
      if (rapor?.pondok) {
        const nOrig = rapor.pondok[orig];
        const nSafe = rapor.pondok[sk];
        if (nOrig !== undefined && nOrig != null) {
          // nested could be object { nilai: 88 } or plain value
          rawVal = nOrig?.nilai ?? nOrig;
        } else if (nSafe !== undefined && nSafe != null) {
          rawVal = nSafe?.nilai ?? nSafe;
        }
      }

   
      // flat fallback (CASE-INSENSITIVE)
if (rawVal === undefined) {
  if (rapor[orig] !== undefined && rapor[orig] !== null) {
    rawVal = rapor[orig];
  } else if (rapor[sk] !== undefined && rapor[sk] !== null) {
    rawVal = rapor[sk];
  } else {
    // 🔑 kunci utama: cari key tanpa peduli besar-kecil
    const foundKey = Object.keys(rapor).find(
      (k) => k.toUpperCase() === sk
    );
    if (foundKey) rawVal = rapor[foundKey];
  }
}


      const nilaiNum = normalizeToNumber(rawVal);
      return { mapel: orig, nilai: nilaiNum };
    })
    // hanya tampilkan yg punya nilai valid (sesuai alur lama)
    .filter((r) => !isNaN(r.nilai));

  // jaga urutan sesuai dataset (dataset sudah dipetakan sehingga map preserve order)
  rows.sort((a, b) => {
    const ia = idxPondok.get(String(a.mapel).toLowerCase());
    const ib = idxPondok.get(String(b.mapel).toLowerCase());
    if (ia != null && ib != null && ia !== ib) return ia - ib;
    return String(a.mapel).localeCompare(String(b.mapel), "id");
  });

  const bio = {
    nisn: rapor.nisn || "-",
    nama: rapor.nama_siswa || "-",
    kelas: rapor.kelas || "-",
    semester: rapor.semester || "-",
    tahun: rapor.tahun_pelajaran || "-",
  };

  return { biodata: bio, rowsPondok: rows };
}, [rapor, datasetPondok]);

  if (loading) return <p className="p-4 text-black">⏳ Memuat...</p>;
  if (!rapor)
    return <p className="p-4 text-red-600">❌ Data tidak ditemukan</p>;

  const arabMap = new Map(
    datasetPondok.map((d) => [String(d.nama).toLowerCase(), d.arab || ""])
  );
  const getArab = (nama) =>
    arabMap.get(String(nama).toLowerCase()) || "";

  const total = rowsPondok.reduce(
    (s, r) => s + (Number(r.nilai) || 0),
    0
  );
  const rata = rowsPondok.length ? total / rowsPondok.length : 0;

  const fmt = (s) =>
    s && s.includes("_") ? s.replace(/_/g, " ") : s || "";

  // ===== DATA HAFALAN =====
  const hafalan = rapor.hafalan || rapor.tahfidz || {};
  const H_totalJuz = Number(hafalan.total_juz ?? 0);
  const H_target = Number(hafalan.target_lembar ?? 0);
  const H_tercapai = Number(hafalan.tercapai_lembar ?? 0);
  const H_ket = (hafalan.keterangan ?? "").toString().trim();
  const H_nilai = Number(hafalan.nilai ?? 0);

  // ===== POIN PELANGGARAN =====
  const P_poin = Number(rapor.poin ?? 0);

  // Semester & Tahun (Umum + Arab)
  const semesterUmum = bio?.semesterUmum || biodata.semester;
  const tahunUmum = bio?.tahunPelajaranUmum || biodata.tahun;
  const semesterArab = bio?.semesterArab || "الفصل الأوّل";
  const tahunArab =
    bio?.tahunPelajaranArab || toArabicDigits(tahunUmum || "");

  const ttdKepalaSekolahUrl = bio?.kepala_sekolah_ttd || "";
  const kopRaporUrl = bio?.kopRaporUrl || "/image/kop.jpg";
  const waktuPembagianRaport =
    bio?.waktuPembagianRaport || "Bagek Nyaka, 1 Oktober 2025";

  /* ===================== Handler Download PDF ===================== */

  const handleDownloadPDF = () => {
    if (typeof window !== "undefined") {
      window.print(); // user pilih "Save as PDF" di dialog print
    }
  };

  /* ===================== Render ===================== */

  return (
    <div
      className="min-h-screen bg-white text-black pb-10 print:bg-white print:p-0"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* Wrapper konten:
          - di layar: max-w-900 dan center
          - di print: full width (max-w-none) */}
      <div className="w-full max-w-[900px] mx-auto p-4 pb-8 print:max-w-none print:pt-[10mm]">
        {/* KOP */}
        <div className="text-center mb-0">
          <img
            src={kopRaporUrl}
            alt="Kop Sekolah"
            className="mx-auto w-full h-auto"
          />
        </div>

        {/* JUDUL */}
        <h1 className="text-center font-semibold text-[18px] tracking-wide mt-2 mb-0">
          كشف درجات اختبار المعهد
        </h1>

        {/* IDENTITAS */}
        <table className="w-full border border-black border-collapse text-[10px] leading-[1.1] mb-1 mt-1">
          <tbody>
            {/* NAMA */}
            <tr>
              <td className="border border-black w-1/4 px-1 py-[1px]">
                Nama
              </td>
              <td className="border border-black w-1/4 font-bold px-1 py-[1px]">
                {biodata.nama}
              </td>
              <td
                className="border border-black w-1/4 font-bold text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                {namaArab && namaArab !== "" ? namaArab : "—"}
              </td>
              <td
                className="border border-black w-1/4 font-bold text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                اسم الطالب
              </td>
            </tr>

            {/* NISN */}
            <tr>
              <td className="border border-black px-1 py-[1px]">
                NIS/NISN
              </td>
              <td className="border border-black px-1 py-[1px]">
                {biodata.nisn}
              </td>
              <td
                className="border border-black text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                {toArabicDigits(biodata.nisn)}
              </td>
              <td
                className="border border-black text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                رقم الطالب
              </td>
            </tr>

            {/* KELAS / SEMESTER */}
            <tr>
              <td className="border border-black px-1 py-[1px]">
                Kelas/Semester
              </td>
              <td className="border border-black px-1 py-[1px]">
                {biodata.kelas}/{semesterUmum}
              </td>
              <td
                className="border border-black text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                {toArabicDigits(biodata.kelas)}/{semesterArab}
              </td>
              <td
                className="border border-black text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                الصف
              </td>
            </tr>

            {/* TAHUN PELAJARAN */}
            <tr>
              <td className="border border-black px-1 py-[1px]">
                Tahun Pelajaran
              </td>
              <td className="border border-black px-1 py-[1px]">
                {tahunUmum}
              </td>
              <td
                className="border border-black text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                {tahunArab}
              </td>
              <td
                className="border border-black text-right px-1 py-[1px]"
                dir="rtl"
                lang="ar"
              >
                العام الدراسي
              </td>
            </tr>
          </tbody>
        </table>

        {/* TABEL NILAI PONDOK */}
<div className="grid grid-cols-2 gap-[2px]">
  {/* ============= INDONESIA ============= */}
  <table className="w-full border border-black border-collapse text-[9px] leading-[1.1]">
    <thead className="bg-emerald-100 text-[10px] font-bold">
      <tr>
        <th className="w-[28px] border border-black text-center px-1 py-[1px]">
          No
        </th>
        <th className="border border-black text-center px-1 py-[1px]">
          Mata Pelajaran
        </th>
        <th className="w-[55px] border border-black text-center px-1 py-[1px]">
          Angka
        </th>
        <th className="border border-black text-center px-1 py-[1px]">
          Huruf
        </th>
      </tr>
    </thead>
    <tbody className="text-[9px]">
      {rowsPondok.length === 0 ? (
        <tr>
          <td
            colSpan={4}
            className="border border-black text-center px-1 py-[1px]"
          >
            Tidak ada data.
          </td>
        </tr>
      ) : (
        rowsPondok.map((r, i) => {
          const n = Number(r.nilai);
          return (
            <tr key={r.mapel}>
              <td className="border border-black text-center px-1 py-[1px]">
                {i + 1}
              </td>
              <td className="border border-black px-1 py-[1px]">
                {fmt(r.mapel)}
              </td>
              {/* Angka di kolom ketiga (seperti gambar) */}
              <td className="border border-black text-center font-semibold px-1 py-[1px]">
                {isNaN(n) ? "" : n}
              </td>
              {/* Tulisan huruf di kanan angka */}
              <td className="border border-black px-1 py-[1px]">
                {isNaN(n) ? "" : terbilangID(n)}
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  </table>

    {/* ============= ARAB ============= */}
  <table
    className="w-full border border-black border-collapse text-[9px] leading-[1.1]"
    dir="rtl"
  >
    <thead className="bg-emerald-100 text-[10px] font-bold">
      <tr>
        {/* urutan: رقم, المادة الدراسية, الدرجة, الدرجة */}
        <th className="w-[28px] border border-black text-center px-1 py-[1px]">
          رقم
        </th>
        <th className="border border-black text-center px-1 py-[1px]">
          المادة الدراسية
        </th>
        <th className="w-[55px] border border-black text-center px-1 py-[1px]">
          رقمًا 
        </th>
        <th className="border border-black text-center px-1 py-[1px]">
          كتابةً
        </th>
      </tr>
    </thead>
    <tbody className="text-[9px]">
      {rowsPondok.length === 0 ? (
        <tr>
          <td
            colSpan={4}
            className="border border-black text-center px-1 py-[1px]"
          >
            لا توجد بيانات
          </td>
        </tr>
      ) : (
        rowsPondok.map((r, i) => {
          const n = Number(r.nilai);
          return (
            <tr key={r.mapel}>
              {/* رقم */}
              <td className="border border-black text-center px-1 py-[1px]">
                {toArabicDigits(i + 1)}
              </td>

              {/* المادة الدراسية */}
              <td className="border border-black text-right px-1 py-[1px]">
                {getArab(r.mapel) || fmt(r.mapel)}
              </td>

              {/* الدرجة (angka Arab, sejajar dengan Angka Indonesia) */}
              <td className="border border-black text-center font-semibold px-1 py-[1px]">
                {isNaN(n) ? "" : toArabicDigits(n)}
              </td>

              {/* الدرجة (tulisan / كتابة nilai) */}
              <td className="border border-black text-right px-1 py-[1px]">
                {isNaN(n) ? "" : terbilangAR(n)}
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  </table>

</div>


        {/* RINGKASAN NILAI */}
        <div className="grid grid-cols-2 gap-[2px] mt-1">
          <table className="w-full border border-black border-collapse text-[10px] leading-[1.1]">
            <tbody>
              <tr>
                <td className="w-[180px] border border-black px-1 py-[1px]">
                  Jumlah Nilai
                </td>
                <td className="w-[80px] border border-black text-center font-semibold px-1 py-[1px]">
                  {total}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Rata-rata Nilai
                </td>
                <td className="border border-black text-center font-semibold px-1 py-[1px]">
                  {rowsPondok.length ? rata.toFixed(1) : "0.0"}
                </td>
              </tr>
            </tbody>
          </table>

          <table
            className="w-full border border-black border-collapse text-[10px] leading-[1.1]"
            dir="rtl"
          >
            <tbody>
              <tr>
                <td className="w-[180px] border border-black text-right px-1 py-[1px]">
                  مجموع الدرجات
                </td>
                <td className="w-[80px] border border-black text-center font-semibold px-1 py-[1px]">
                  {toArabicDigits(total)}
                </td>
              </tr>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  معدل الدرجات
                </td>
                <td className="border border-black text-center font-semibold px-1 py-[1px]">
                  {toArabicDigits(
                    rowsPondok.length ? String(rata.toFixed(1)) : "0.0"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* HAFALAN */}
        <div className="grid grid-cols-2 gap-[2px] mt-1">
          <table className="w-full border border-black border-collapse text-[10px] leading-[1.1]">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="border border-black text-center font-bold px-1 py-[1px]"
                >
                  Penilaian Hafalan Al-Qur’an
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Total Hafalan
                </td>
                <td className="border border-black px-1 py-[1px]">
                  {H_totalJuz} Juz
                </td>
              </tr>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Target Semester
                </td>
                <td className="border border-black px-1 py-[1px]">
                  {H_target} Lembar
                </td>
              </tr>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Ketercapaian semester ini
                </td>
                <td className="border border-black px-1 py-[1px]">
                  {H_tercapai} Lembar
                </td>
              </tr>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Nilai
                </td>
                <td className="border border-black px-1 py-[1px]">
                  {H_nilai}
                </td>
              </tr>
            </tbody>
          </table>

          <table
            className="w-full border border-black border-collapse text-[10px] leading-[1.1]"
            dir="rtl"
          >
            <thead>
              <tr>
                <th
                  colSpan={2}
                  className="border border-black text-center font-bold px-1 py-[1px]"
                >
                  تقييم الحفظ لِلْقُرْآن
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  مجموع الحفظ
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(H_totalJuz)} جزء
                </td>
              </tr>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  أهداف الفصل الدراسي
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(H_target)} أوراق
                </td>
              </tr>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  تحقيق أهداف الفصل الدراسي
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(H_tercapai)} أوراق
                </td>
              </tr>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  (التقدير)
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(H_nilai)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ABSENSI */}
        <div className="grid grid-cols-2 gap-[2px] mt-1">
          <table className="w-full border border-black border-collapse text-[10px] leading-[1.1]">
            <thead className="bg-emerald-100 font-bold">
              <tr>
                <th className="border border-black text-center px-1 py-[1px]">
                  Keterangan
                </th>
                <th className="border border-black text-center px-1 py-[1px]">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Sakit
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {rapor.sakit || 0} hari
                </td>
              </tr>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Izin
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {rapor.izin || 0} hari
                </td>
              </tr>
              <tr>
                <td className="border border-black whitespace-nowrap px-1 py-[1px]">
                  Tanpa Keterangan
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {rapor.alpha || 0} hari
                </td>
              </tr>
            </tbody>
          </table>

          <table
            className="w-full border border-black border-collapse text-[10px] leading-[1.1]"
            dir="rtl"
          >
            <thead className="bg-emerald-100 font-bold">
              <tr>
                <th className="border border-black text-center px-1 py-[1px]">
                  الوصف
                </th>
                <th className="border border-black text-center px-1 py-[1px]">
                  العدد
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  مريض
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(rapor.sakit || 0)}
                </td>
              </tr>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  إذن
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(rapor.izin || 0)}
                </td>
              </tr>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  بدون بيان
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(rapor.alpha || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* POIN PELANGGARAN */}
        <div className="grid grid-cols-2 gap-[2px] mt-1">
          {/* Indonesia */}
          <table className="w-full border border-black border-collapse text-[10px] leading-[1.1]">
            <thead className="bg-emerald-100 font-bold">
              <tr>
                <th className="border border-black text-center px-1 py-[1px]">
                  Poin Pelanggaran Santri
                </th>
                <th className="border border-black text-center px-1 py-[1px]">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-1 py-[1px]">
                  Jumlah poin pelanggaran
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {P_poin} poin
                </td>
              </tr>
            </tbody>
          </table>

          {/* Arab */}
          <table
            className="w-full border border-black border-collapse text-[10px] leading-[1.1]"
            dir="rtl"
          >
            <thead className="bg-emerald-100 font-bold">
              <tr>
                <th className="border border-black text-center px-1 py-[1px]">
                  نقاط المخالفة للطالب
                </th>
                <th className="border border-black text-center px-1 py-[1px]">
                  العدد
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black text-right px-1 py-[1px]">
                  مجموع نقاط المخالفة
                </td>
                <td className="border border-black text-center px-1 py-[1px]">
                  {toArabicDigits(P_poin)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* CATATAN WALI */}
        <table className="w-full border border-black border-collapse text-[10px] leading-[1.1] mt-1">
          <tbody>
            <tr>
              <td className="border border-black px-1 py-[1px] text-left">
                <span className="font-bold">
                  Catatan Wali Kelas:
                </span>
                <span className="italic">
                  {rapor?.catatan_wali &&
                  String(rapor.catatan_wali).trim() !== ""
                    ? ` ${rapor.catatan_wali}`
                    : " Ilmu akan menjadi cahaya bagi kehidupan, perbanyak membaca dan belajar dengan tekun."}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* TANDA TANGAN */}
<table className="w-full text-[10px] leading-[1.1] mt-6 border-collapse">
  <tbody>
    <tr>
      {/* Orang tua */}
      <td className="w-1/3 align-top text-left">
        Mengetahui
        <br />
        Orang Tua/Wali,
        <div className="h-[70px]" />
        <div>......................</div>
      </td>

      {/* Kepala sekolah */}
      <td className="w-1/3 align-top text-center">
        Mengetahui
        <br />
        Kepala Sekolah
        <div className="h-[70px] flex flex-col items-center justify-end">
          {ttdKepalaSekolahUrl && (
            <img
              src={ttdKepalaSekolahUrl}
              alt="TTD Kepala Sekolah"
              className="h-14 w-40 object-contain mb-1"
            />
          )}
        </div>
        <div className="inline-block text-left">
  <div className="font-bold underline">
    {formatNamaGelar(bio?.kepala_sekolah)}
  </div>
  <div className="mt-0.5">NIY. </div>
</div>
        
      </td>

      {/* Wali kelas */}
      <td className="w-1/3 align-top text-right">
        {waktuPembagianRaport}
        <br />
        Wali Kelas,
        <div className="h-[70px]" />
        <div className="font-bold underline">
          {formatNamaGelar(wali?.nama_wali)}
        </div>
       
      </td>
    </tr>
  </tbody>
</table>

      </div>

      {/* Tombol Download (print) */}
      <div className="mt-4 print:hidden flex justify-center">
        <button
          onClick={handleDownloadPDF}
          className="bg-black text-white px-4 py-2 rounded text-sm"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
