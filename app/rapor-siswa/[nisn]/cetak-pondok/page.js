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

// Normalisasi nilai → angka murni (untuk total/rata2)
function normalizeToNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return isNaN(n) ? NaN : n;
  }
  if (typeof v === "object") {
    // pola umum: { nilai: 80 } atau { value: "80" }
    if (v.nilai != null) return normalizeToNumber(v.nilai);
    if (v.value != null) return normalizeToNumber(v.value);
  }
  return NaN;
}

/** Terbilang Indonesia sederhana untuk 0..100 */
function terbilangID(n) {
  const angka = [
    "Nol","Satu","Dua","Tiga","Empat","Lima","Enam","Tujuh","Delapan","Sembilan","Sepuluh","Sebelas"
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
    "A": "أ",
    "B": "ب"
  };

  return String(input).replace(/[0-9AB]/g, (ch) => map[ch] || ch);
}

/** Terbilang Arab sederhana 0..100 */
function terbilangAR(n) {
  if (isNaN(n) || n < 0 || n > 100) return "";
  const upTo10 = ["صفر","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة"];
  if (n <= 10) return upTo10[n];
  if (n === 11) return "أحد عشر";
  if (n === 12) return "اثنا عشر";
  if (n > 12 && n < 20) return upTo10[n - 10] + " عشر";
  const tensMap = {
    20:"عشرون",30:"ثلاثون",40:"أربعون",50:"خمسون",
    60:"ستون",70:"سبعون",80:"ثمانون",90:"تسعون",100:"مائة"
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

  // Tambahan: Bio sekolah & Wali Kelas
  const [bio, setBio] = useState(null);
  const [wali, setWali] = useState(null);

  /* ===================== Fetching ===================== */

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

  // Ambil rapor by NISN (koleksi "raport", field nisn == params)
  useEffect(() => {
    const run = async () => {
      try {
        if (!nisnParam) return;
        const q = query(collection(db, "raport"), where("nisn", "==", nisnParam));
        const snap = await getDocs(q);
        if (!snap.empty) setRapor(snap.docs[0].data());
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [nisnParam]);

  // Ambil dataset mapel pondok (pakai orderBy jika ada createdAt)
  useEffect(() => {
    const run = async () => {
      try {
        let snap;
        try {
          snap = await getDocs(query(collection(db, "dataset_mapel_pondok"), orderBy("createdAt", "asc")));
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

  // Bio sekolah
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

  // Wali kelas
  useEffect(() => {
    const run = async () => {
      try {
        if (!rapor?.kelas) return;
        const qW = query(collection(db, "wali_kelas"), where("kelas", "==", rapor.kelas));
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

    const allKeys = Object.keys(rapor || {});
    const isUmum = (k) => MAPEL_UMUM.some((u) => u.toLowerCase() === String(k).toLowerCase());
    const nilaiKeys = allKeys.filter(
      (k) => !FIX_KEYS.includes(k) && !String(k).startsWith("capaian_")
    );

    // ——— konsisten dgn page "lihat rapor": hanya mapel yg ADA di dataset pondok, urut sesuai dataset
    const namaPondokSet = new Set(datasetPondok.map((d) => String(d.nama || "").toLowerCase()));
    const idxPondok = new Map();
    datasetPondok.forEach((d, i) => idxPondok.set(String(d.nama || "").toLowerCase(), i));

    const rows = nilaiKeys
      .filter((k) => !isUmum(k) && namaPondokSet.has(String(k).toLowerCase()))
      .map((k) => {
        const nilaiNum = normalizeToNumber(rapor[k]);
        return { mapel: k, nilai: nilaiNum };
      })
      .filter((r) => !isNaN(r.nilai));

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
  if (!rapor) return <p className="p-4 text-red-600">❌ Data tidak ditemukan</p>;

  // Map nama → arab (untuk kolom label Arab)
  const arabMap = new Map(
    datasetPondok.map((d) => [String(d.nama).toLowerCase(), d.arab || ""])
  );
  const getArab = (nama) => arabMap.get(String(nama).toLowerCase()) || "";

  // Ringkasan
  const total = rowsPondok.reduce((s, r) => s + (Number(r.nilai) || 0), 0);
  const rata = rowsPondok.length ? total / rowsPondok.length : 0;

  const fmt = (s) => (s && s.includes("_") ? s.replace(/_/g, " ") : s || "");

  // ===== DATA HAFALAN (fallback ke tahfidz) =====
  const hafalan = rapor.hafalan || rapor.tahfidz || {};
  const H_totalJuz = Number(hafalan.total_juz ?? 0);
  const H_target = Number(hafalan.target_lembar ?? 0);
  const H_tercapai = Number(hafalan.tercapai_lembar ?? 0);
  const H_ket = (hafalan.keterangan ?? "").toString().trim();
  const H_nilai = Number(hafalan.nilai ?? 0);

  /* ===================== Render ===================== */
  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* F4 wrapper: gunakan max-h agar tidak memicu halaman kosong */}
      <div className="mx-auto w-[210mm] max-h-[330mm] p-4 print:p-6">
        {/* KOP */}
        <div className="text-center mb-0">
          <img src="/image/kop.jpg" alt="Kop Sekolah" className="mx-auto w-full h-auto" />
        </div>

        {/* JUDUL */}
        <h1 className="text-center font-semibold text-[18px] tracking-wide mt-2 mb-0">
          كشف درجات اختبار المعهد
        </h1>

        {/* IDENTITAS */}
        <table className="w-full border border-black border-collapse text-[11px] leading-tight mb-2 mt-2">
  <tbody>
    {/* NAMA */}
    <tr>
      <td className="border border-black w-1/4">Nama</td>
      <td className="border border-black w-1/4 font-bold">{biodata.nama}</td>

      {/* NILAI ARAB (kolom 3) */}
      <td className="border border-black w-1/4 font-bold text-right p-0" dir="rtl" lang="ar">
        {namaArab && namaArab !== "" ? namaArab : "—"}
      </td>
      {/* LABEL ARAB (kolom 4) */}
      <td className="border border-black w-1/4 font-bold text-right p-0" dir="rtl" lang="ar">
        اسم الطالب
      </td>
    </tr>

    {/* NIS/NISN */}
    <tr>
      <td className="border border-black">NIS/NISN</td>
      <td className="border border-black">{biodata.nisn}</td>

      {/* NILAI ARAB */}
      <td className="border border-black text-right p-0" dir="rtl" lang="ar">
        {toArabicDigits(biodata.nisn)}
      </td>
      {/* LABEL ARAB */}
      <td className="border border-black text-right p-0" dir="rtl" lang="ar">
        رقم الطالب
      </td>
    </tr>

    {/* KELAS/SEMESTER */}
    <tr>
      <td className="border border-black">Kelas/Semester</td>
      <td className="border border-black">{biodata.kelas}/Ganjil</td>

      {/* NILAI ARAB */}
      <td className="border border-black text-right p-0" dir="rtl" lang="ar">
        {toArabicDigits(biodata.kelas)}/الفصل الأوّل
      </td>
      {/* LABEL ARAB */}
      <td className="border border-black text-right p-0" dir="rtl" lang="ar">
        الصف
      </td>
    </tr>

    {/* TAHUN PELAJARAN */}
    <tr>
      <td className="border border-black">Tahun Pelajaran</td>
      <td className="border border-black">2025/2026</td>

      {/* NILAI ARAB */}
      <td className="border border-black text-right p-0" dir="rtl" lang="ar">
        ٢٠٢٥/٢٠٢٦
      </td>
      {/* LABEL ARAB */}
      <td className="border border-black text-right p-0" dir="rtl" lang="ar">
        العام الدراسي
      </td>
    </tr>
  </tbody>
</table>



        {/* DUA TABEL: Indonesia & Arab (dinamis dari dataset pondok) */}
        <div className="grid grid-cols-2 gap-[2px]">
          {/* INDONESIA */}
          <table className="w-full border border-black border-collapse">
            <thead className="bg-emerald-100 text-[11px] font-bold">
              <tr>
                <th className="w-[28px] border border-black text-center">No</th>
                <th className="w-[210px] border border-black text-center">Mata Pelajaran</th>
                <th className="w-[55px] border border-black text-center">Angka</th>
                <th className="w-[200px] border border-black text-center">Huruf</th>
              </tr>
            </thead>
            <tbody className="text-[10px]">
              {rowsPondok.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-black text-center">Tidak ada data.</td>
                </tr>
              ) : (
                rowsPondok.map((r, i) => {
                  const n = Number(r.nilai);
                  return (
                    <tr key={r.mapel}>
                      <td className="border border-black text-center">{i + 1}</td>
                      <td className="border border-black">{fmt(r.mapel)}</td>
                      <td className="border border-black text-center font-semibold">{isNaN(n) ? "" : n}</td>
                      <td className="border border-black">{isNaN(n) ? "" : terbilangID(n)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* ARAB */}
          <table className="w-full border border-black border-collapse" dir="rtl" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            <thead className="bg-emerald-100 text-[11px] font-bold">
              <tr>
                <th className="w-[28px] border border-black text-center">رقم</th>
                <th className="w-[210px] border border-black text-center">المادة الدراسية</th>
                <th className="w-[55px] border border-black text-center">الدرجة</th>
                <th className="w-[200px] border border-black text-center">كتابة</th>
              </tr>
            </thead>
            <tbody className="text-[10px]">
              {rowsPondok.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-black text-center">لا توجد بيانات</td>
                </tr>
              ) : (
                rowsPondok.map((r, i) => {
                  const n = Number(r.nilai);
                  return (
                    <tr key={r.mapel}>
                      <td className="border border-black text-center">{toArabicDigits(i + 1)}</td>
                      <td className="border border-black text-right">{getArab(r.mapel) || fmt(r.mapel)}</td>
                      <td className="border border-black text-center font-semibold">{isNaN(n) ? "" : toArabicDigits(n)}</td>
                      <td className="border border-black text-right">{isNaN(n) ? "" : terbilangAR(n)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* RINGKASAN / JUMLAH NILAI */}
        <div className="grid grid-cols-2 gap-[2px] mt-2">
          <table className="w-full border border-black border-collapse text-[11px]">
            <tbody>
              <tr>
                <td className="w-[180px] border border-black">Jumlah Nilai</td>
                <td className="w-[80px] border border-black text-center font-semibold">{total}</td>
              </tr>
              <tr>
                <td className="border border-black">Rata-rata Nilai</td>
                <td className="border border-black text-center font-semibold">{rowsPondok.length ? rata.toFixed(1) : "0.0"}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-black border-collapse text-[11px]" dir="rtl">
            <tbody>
              <tr>
                <td className="w-[180px] border border-black text-right">مجموع الدرجات</td>
                <td className="w-[80px] border border-black text-center font-semibold">{toArabicDigits(total)}</td>
              </tr>
              <tr>
                <td className="border border-black text-right">معدل الدرجات</td>
                <td className="border border-black text-center font-semibold">
                  {toArabicDigits(rowsPondok.length ? String(rata.toFixed(1)) : "0.0")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== HAFALAN AL-QUR'AN ===== */}
        <div className="grid grid-cols-2 gap-[2px] mt-2" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
          {/* Indonesia */}
          <table className="w-full border border-black border-collapse text-[11px]">
            <thead>
              <tr>
                <th colSpan={2} className="border border-black text-center font-bold">Penilaian Hafalan Al-Qur’an</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black">Total Hafalan</td>
                <td className="border border-black">{H_totalJuz} Juz</td>
              </tr>
              <tr>
                <td className="border border-black">Target Semester</td>
                <td className="border border-black">{H_target} Lembar</td>
              </tr>
              <tr>
                <td className="border border-black">Ketercapaian semester ini</td>
                <td className="border border-black">{H_tercapai} Lembar</td>
              </tr>              
              <tr>
                <td className="border border-black">Nilai</td>
                <td className="border border-black">{H_nilai}</td>
              </tr>
            </tbody>
          </table>

          {/* Arab */}
          <table className="w-full border border-black border-collapse text-[11px]" dir="rtl">
            <thead>
              <tr>
                <th colSpan={2} className="border border-black text-center font-bold">تقييم الحفظ لِلْقُرْآن</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black text-right">مجموع الحفظ</td>
                <td className="border border-black text-center">{toArabicDigits(H_totalJuz)} جزء</td>
              </tr>
              <tr>
                <td className="border border-black text-right">أهداف الفصل الدراسي</td>
                <td className="border border-black text-center">{toArabicDigits(H_target)} أوراق</td>
              </tr>
              <tr>
                <td className="border border-black text-right">تحقيق أهداف الفصل الدراسي</td>
                <td className="border border-black text-center">{toArabicDigits(H_tercapai)} أوراق</td>
              </tr>             
              <tr>
                <td className="border border-black text-right">(التقدير)</td>
                <td className="border border-black text-center">{toArabicDigits(H_nilai)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ABSENSI */}
        <div className="mt-3 grid grid-cols-2 gap-[2px]">
          <table className="w-full border border-black border-collapse text-[11px]">
            <thead className="bg-emerald-100 font-bold">
              <tr>
                <th className="border border-black text-center">Keterangan</th>
                <th className="border border-black text-center">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black">Sakit</td>
                <td className="border border-black text-center">{rapor.sakit || 0} hari</td>
              </tr>
              <tr>
                <td className="border border-black">Izin</td>
                <td className="border border-black text-center">{rapor.izin || 0} hari</td>
              </tr>
              <tr>
                <td className="border border-black whitespace-nowrap">Tanpa Keterangan</td>
                <td className="border border-black text-center">{rapor.alpha || 0} hari</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-black border-collapse text-[11px]" dir="rtl">
            <thead className="bg-emerald-100 font-bold">
              <tr>
                <th className="border border-black text-center">الوصف</th>
                <th className="border border-black text-center">العدد</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black text-right">مريض</td>
                <td className="border border-black text-center">{toArabicDigits(rapor.sakit || 0)}</td>
              </tr>
              <tr>
                <td className="border border-black text-right">إذن</td>
                <td className="border border-black text-center">{toArabicDigits(rapor.izin || 0)}</td>
              </tr>
              <tr>
                <td className="border border-black text-right">بدون بيان</td>
                <td className="border border-black text-center">{toArabicDigits(rapor.alpha || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Catatan Wali: satu baris tabel hemat tempat */}
        <table className="w-full border border-black border-collapse text-[11px] leading-tight mt-2">
  <tbody>
    <tr>
      <td className="border border-black p-1 text-left">
        <span className="font-bold">Catatan Wali Kelas:</span>
        <span className="italic">
          {rapor?.catatan_wali && String(rapor.catatan_wali).trim() !== ""
            ? ` ${rapor.catatan_wali}`
            : " Ilmu akan menjadi cahaya bagi kehidupan, perbanyak membaca dan belajar dengan tekun."}
        </span>
      </td>
    </tr>
  </tbody>
</table>

        {/* Tanda Tangan: 1 baris, Kepala di tengah */}
        <table className="w-full text-[11px] leading-tight mt-8 border-collapse">
          <tbody>
            <tr>
              {/* Orang Tua/Wali */}
              <td className="w-1/3 border-0 align-top text-left">
                Mengetahui<br />
                Orang Tua/Wali,<br />
                <div className="mt-12">......................</div>
              </td>

              {/* Kepala Sekolah (tengah) */}
              <td className="w-1/3 border-0 align-top text-center">
                Mengetahui<br />
                Kepala Sekolah<br />
                <div className="mt-12 inline-block text-center">
                  <div className="font-bold underline">{formatNamaGelar(bio?.kepala_sekolah)}</div>
                  <div className="text-left">NIP.</div>
                </div>
              </td>

              {/* Wali Kelas */}
              <td className="w-1/3 border-0 align-top text-right">
                Bagek Nyaka, 1 Oktober 2025<br />
                Wali Kelas,<br />
                <div className="mt-12 inline-block text-left">
                  <div className="font-bold underline">{formatNamaGelar(wali?.nama_wali)}</div>
                  <div>NIP.</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tombol Print */}
        <div className="mt-3 print:hidden">
          <button onClick={() => window.print()} className="bg-black text-white px-3 py-1.5 rounded text-[11px]">
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
