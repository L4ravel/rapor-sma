"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Trophy, Award, Star, Sparkles, X } from 'lucide-react';

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
  "locked",
  "poin", 
];

// === SAFE KEY HELPER (ubah "Tajwid/Tahsin" → "TAJWID_TAHSIN") ===
const safeKey = (name) =>
  String(name || "")
    .toUpperCase()
    .replace(/\//g, "_")
    .replace(/\./g, "_")
    .trim();

// baca nilai flat (cek key asli + key aman)
const readFlat = (rap, name) => {
  if (!rap) return undefined;
  if (rap[name] !== undefined) return rap[name];
  const sk = safeKey(name);
  return rap[sk];
};

// baca nilai nested pondok (cek nested asli + nested safe)
const readPondok = (rap, name) => {
  if (!rap?.pondok) return undefined;
  const n1 = rap.pondok[name];
  if (n1 !== undefined) return n1;
  const sk = safeKey(name);
  return rap.pondok[sk];
};

// Normalisasi nilai agar tidak me-render object langsung
function normalizeNilai(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v.nilai === "number" || typeof v.nilai === "string")
      return v.nilai;
    if (typeof v.value === "number" || typeof v.value === "string")
      return v.value;
    try {
      const pairs = Object.entries(v).map(([k, val]) =>
        `${k}: ${
          typeof val === "object" ? JSON.stringify(val) : String(val)
        }`
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
  const router = useRouter();
  const [rapor, setRapor] = useState(null);
  const [bio, setBio] = useState(null); // bio sekolah untuk kop konsisten
  const [loading, setLoading] = useState(true);
  const [redirectChecked, setRedirectChecked] = useState(false);

  const [dsUmum, setDsUmum] = useState([]); // [{nama}]
  const [dsPondok, setDsPondok] = useState([]); // [{nama, arab?}]
  const [loadingDs, setLoadingDs] = useState(true);
  const [rankInfo, setRankInfo] = useState(null);
  const [showRankModal, setShowRankModal] = useState(false);
const [rankLoading, setRankLoading] = useState(false);
  const rap = rapor || {};


  // Check redirect hanya sekali dan stabil
  useEffect(() => {
    if (redirectChecked) return;

    const RELEASE = new Date("2025-12-20T08:00:00+08:00").getTime();
    const now = Date.now();

    let role = null;
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("appUser");
        if (local) {
          const parsed = JSON.parse(local);
          role = parsed.role || null;
        }
      } catch (e) {
        console.warn("Error parsing localStorage:", e);
      }
    }

    const isAdmin = role === "admin" || role === "superadmin";

    if (!isAdmin && now < RELEASE) {
      router.replace(`/rapor-siswa/${encodeURIComponent(nisn)}/gate`);
      return;
    }

    setRedirectChecked(true);
  }, [router, nisn, redirectChecked]);

  // Ambil data rapor by docId = NISN
  useEffect(() => {
    if (!redirectChecked) return; // Tunggu redirect check selesai

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
  }, [nisn, redirectChecked]);

  // Ambil dataset mapel (umum & pondok)
  useEffect(() => {
    if (!redirectChecked) return; // Tunggu redirect check selesai

    const run = async () => {
      try {
        let sUmum;
        try {
          sUmum = await getDocs(
            query(
              collection(db, "dataset_mapel_umum"),
              orderBy("createdAt", "asc")
            )
          );
        } catch {
          sUmum = await getDocs(collection(db, "dataset_mapel_umum"));
        }
        setDsUmum(sUmum.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));

        let sPondok;
        try {
          sPondok = await getDocs(
            query(
              collection(db, "dataset_mapel_pondok"),
              orderBy("createdAt", "asc")
            )
          );
        } catch {
          sPondok = await getDocs(collection(db, "dataset_mapel_pondok"));
        }
        setDsPondok(
          sPondok.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
        );
      } catch (e) {
        console.error("Gagal ambil dataset mapel:", e);
      } finally {
        setLoadingDs(false);
      }
    };
    run();
  }, [redirectChecked]);

  // Ambil bio sekolah untuk kop biodata yang konsisten dengan umum
  useEffect(() => {
    const run = async () => {
      try {
        const snap = await getDoc(doc(db, "bio_sekolah", "default"));
        if (snap.exists()) setBio(snap.data());
      } catch (e) {
        console.error("Gagal ambil bio sekolah:", e);
      }
    };
    run();
  }, []);

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

  // ==== Semua hooks di bawah ini SELALU dipanggil ====

  
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
    () =>
      allKeys.filter(
        (k) => !FIX_KEYS.includes(k) && !k.startsWith("capaian_")
      ),
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
  const hasValue = (v) =>
    v !== null && v !== undefined && String(v).trim() !== "";

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
        const capaian = normalizeCapaian(
          capaianMap[capKey1] ?? capaianMap[capKey2] ?? ""
        );
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
  if (!dsPondok.length) return [];

  const rows = dsPondok
    .map((d) => {
      const name = d.nama || "";
      const sk = safeKey(name);

      // 1️⃣ cek nested: rap.pondok[name] / rap.pondok[SAFE]
      const nested = readPondok(rap, name);
      let rawNilai =
        nested?.nilai !== undefined ? nested.nilai : nested;

      // 2️⃣ cek flat: rap[name] / rap[SAFE]
      if (rawNilai === undefined) {
        rawNilai = readFlat(rap, name);
      }

      const nilai = normalizeNilai(rawNilai);
      return { mapel: name, nilai };
    })
    .filter((r) => hasValue(r.nilai));

  // urut sesuai dataset mapel pondok
  rows.sort((a, b) => {
    const ia = idxPondok.get(String(a.mapel).toLowerCase());
    const ib = idxPondok.get(String(b.mapel).toLowerCase());
    if (ia != null && ib != null && ia !== ib) return ia - ib;
    return a.mapel.localeCompare(b.mapel, "id");
  });

  return rows;
}, [dsPondok, rap, idxPondok]);

useEffect(() => {
  if (!rap?.nisn || !rap?.kelas) return;

  const runRank = async () => {
    // 1. ambil semua raport
    const snap = await getDocs(collection(db, "raport"));

    // 2. ambil hanya raport siswa DI KELAS YANG SAMA
    const kelasTarget = String(rap.kelas).toLowerCase();

    const totals = snap.docs
      .map((doc) => {
        const data = doc.data();

        // ❗ filter kelas
        if (String(data.kelas).toLowerCase() !== kelasTarget) {
          return null;
        }

        // 3. jumlahkan semua nilai mapel (angka saja)
        const totalNilai = Object.values(data)
          .filter((v) => typeof v === "number")
          .reduce((a, b) => a + b, 0);

        return {
          nisn: doc.id,
          total: totalNilai,
        };
      })
      .filter(Boolean); // buang null

    // 4. urutkan
    totals.sort((a, b) => b.total - a.total);

    // 5. cari ranking siswa ini
    const rank =
      totals.findIndex((t) => t.nisn === rap.nisn) + 1;

    setRankInfo({
      rank,
      totalSiswa: totals.length,
    });
  };

  runRank();
}, [rap]);




  // ==== Setelah semua hooks dipanggil, baru conditional return ====

  if (!redirectChecked)
    return (
      <div className="min-h-screen bg-gray-100 text-black flex items-center justify-center">
        <p className="p-8 text-center">🔍 Memeriksa akses...</p>
      </div>
    );

  if (loading || loadingDs)
    return (
      <div className="min-h-screen bg-gray-100 text-black flex items-center justify-center">
        <p className="p-8 text-center">⏳ Memuat data...</p>
      </div>
    );

  if (!rapor)
    return (
      <div className="min-h-screen bg-gray-100 text-black">
        <p className="p-8 text-red-600">❌ Data tidak ditemukan</p>
      </div>
    );

  // Jika rapor dikunci (belum lunas), tampilkan pop-up info & blokir rapor
  if (rapor && rapor.locked === true) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-10 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 text-center text-black">
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-xl font-bold mb-2">Rapor Masih Terkunci</h1>
          <p className="text-sm text-gray-700 mb-4">
            Rapor Anda belum dapat ditampilkan karena status pembayaran{" "}
            <span className="font-semibold">belum lunas</span>. Harap
            melunasi terlebih dahulu sesuai ketentuan.
          </p>
          <p className="text-sm text-gray-700 mb-6">
            Jika sudah melunasi, silakan{" "}
            <span className="font-semibold">menghubungi wali kelas</span> agar
            rapor dapat dibuka.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 transition"
            >
              ⬅️ Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  const TableUmum = () => (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-6">
      <h2 className="bg-indigo-200 text-black p-3 font-semibold">
        📗 Mapel Umum
      </h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-indigo-100 text-black">
          <tr>
            <th className="w-1/12 p-3 text-center border border-gray-200">
              No
            </th>
            <th className="w-4/12 p-3 text-left border border-gray-200">
              Mata Pelajaran
            </th>
            <th className="w-1/12 p-3 text-center border border-gray-200">
              Nilai
            </th>
            <th className="w-6/12 p-3 text-left border border-gray-200">
              Capaian
            </th>
          </tr>
        </thead>
        <tbody className="text-black">
          {rowsUmum.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="p-3 text-center text-gray-600 border border-gray-200"
              >
                Tidak ada data mapel umum (dataset kosong atau belum ada
                nilai).
              </td>
            </tr>
          ) : (
            rowsUmum.map((r, i) => (
              <tr key={r.mapel} className="hover:bg-gray-50">
                <td className="p-3 text-center border border-gray-200">
                  {i + 1}
                </td>
                <td className="p-3 border border-gray-200">{fmt(r.mapel)}</td>
                <td className="p-3 text-center font-semibold border border-gray-200">
                  {r.nilai}
                </td>
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
      <h2 className="bg-emerald-200 text-black p-3 font-semibold">
        📘 Mapel Pondok
      </h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-emerald-100 text-black">
          <tr>
            <th className="w-1/12 p-3 text-center border border-gray-200">
              No
            </th>
            <th className="w-7/12 p-3 text-left border border-gray-200">
              Mata Pelajaran
            </th>
            <th className="w-4/12 p-3 text-center border border-gray-200">
              Nilai
            </th>
          </tr>
        </thead>
        <tbody className="text-black">
          {rowsPondok.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="p-3 text-center text-gray-600 border border-gray-200"
              >
                Tidak ada data mapel pondok (dataset kosong atau belum ada
                nilai).
              </td>
            </tr>
          ) : (
            rowsPondok.map((r, i) => (
              <tr key={r.mapel} className="hover:bg-gray-50">
                <td className="p-3 text-center border border-gray-200">
                  {i + 1}
                </td>
                <td className="p-3 border border-gray-200">{fmt(r.mapel)}</td>
                <td className="p-3 text-center font-semibold border border-gray-200">
                  {r.nilai}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

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
          {"📖 Hafalan Al Qur'an"}
        </h2>

        {kosong ? (
          <div className="p-4 text-sm text-gray-600">
            Belum ada data hafalan untuk siswa ini.
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-gray-50 text-black">
              <tr>
                <th className="p-3 text-left border border-gray-200 w-1/2">
                  {"Penilaian Hafalan Al Qur'an"}
                </th>
                <th className="p-3 text-left border border-gray-200 w-1/2"></th>
              </tr>
            </thead>
            <tbody className="text-black">
              <tr>
                <td className="p-2 border border-gray-200">Total Hafalan</td>
                <td className="p-2 border border-gray-200">
                  {totalJuz || "0"} Juz
                </td>
              </tr>
              <tr>
                <td className="p-2 border border-gray-200">Target Semester</td>
                <td className="p-2 border border-gray-200">
                  {target || "0"} Lembar
                </td>
              </tr>
              <tr>
                <td className="p-2 border border-gray-200">
                  Ketercapaian Semester Ini
                </td>
                <td className="p-2 border border-gray-200">
                  {tercapai || "0"} Lembar
                </td>
              </tr>
              <tr>
                <td className="p-2 border border-gray-200">Keterangan</td>
                <td className="p-2 border border-gray-200 whitespace-pre-wrap break-words">
                  {ket || "—"}
                </td>
              </tr>
              <tr>
                <td className="p-2 border border-gray-200">Nilai</td>
                <td className="p-2 border border-gray-200">
                  {nilai || "0"}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const TableAbsensi = () => (
    <div className="bg-white shadow rounded-lg overflow-hidden mt-6">
      <h2 className="text-lg font-semibold text-black p-4 border-b">
        📌 Absensi
      </h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-indigo-100 text-black">
          <tr>
            <th className="w-1/3 p-3 text-center border border-gray-200">
              Sakit
            </th>
            <th className="w-1/3 p-3 text-center border border-gray-200">
              Izin
            </th>
            <th className="w-1/3 p-3 text-center border border-gray-200">
              Alpha
            </th>
          </tr>
        </thead>
        <tbody className="text-black">
          <tr className="text-center">
            <td className="p-3 border border-gray-200">
              {normalizeNilai(rap.sakit) || 0}
            </td>
            <td className="p-3 border border-gray-200">
              {normalizeNilai(rap.izin) || 0}
            </td>
            <td className="p-3 border border-gray-200">
              {normalizeNilai(rap.alpha) || 0}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const TablePoinPelanggaran = () => (
    <div className="bg-white shadow rounded-lg overflow-hidden mt-4">
      <h2 className="text-lg font-semibold text-black p-4 border-b">
        ⚠️ Poin Pelanggaran
      </h2>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-rose-100 text-black">
          <tr>
            <th className="w-3/4 p-3 text-left border border-gray-200">
              Keterangan
            </th>
            <th className="w-1/4 p-3 text-center border border-gray-200">
              Jumlah
            </th>
          </tr>
        </thead>
        <tbody className="text-black">
          <tr>
            <td className="p-3 border border-gray-200">
              Jumlah poin pelanggaran
            </td>
            <td className="p-3 text-center border border-gray-200">
              {normalizeNilai(rap.poin) || 0}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

const TableRanking = () => {
  const [showRankModal, setShowRankModal] = useState(false);
  const [rankLoading, setRankLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // ⬅️ RETURN SETELAH HOOK
  if (!rankInfo) return null;

  const handleOpen = () => {
    setRankLoading(true);
    setShowRankModal(true);

    setTimeout(() => {
      setRankLoading(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }, 4000);
  };

  return (
    <>
      {/* ===== BUTTON CARD ===== */}
      <div className="relative bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-xl rounded-2xl mt-4 p-8 text-center overflow-hidden border border-indigo-100">
        <button
          onClick={handleOpen}
          className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-lg shadow-2xl hover:scale-105 transition"
        >
          🏆 Lihat Rangking
        </button>
      </div>

      {/* ===== MODAL ===== */}
      {showRankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-[90%] max-w-[380px] text-center p-6 md:p-8">
            {rankLoading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="text-6xl animate-bounce">🏆</span>
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-gray-700 font-semibold">
                  Menghitung peringkat...
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-extrabold text-indigo-600 mb-6">
                  🏆 Peringkat Kelas
                </h3>

                {/* === RANK DISPLAY (FADE → TERANG) === */}
               <div className="bg-white rounded-3xl p-5 md:p-8 mb-6 shadow-xl border-2 border-indigo-100 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-100/40 to-transparent animate-revealSweep" />

                  <div className="relative z-10">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-3">
                      Rangking
                    </div>

                    <div className="text-6xl md:text-8xl font-black bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent opacity-0 animate-rankReveal">
                      {rankInfo.rank}
                    </div>

                    <div className="mt-4 text-sm font-semibold text-gray-600 opacity-0 animate-rankSubReveal">
                      dari{" "}
                      <span className="text-xl font-bold text-indigo-600">
                        {rankInfo.totalSiswa}
                      </span>{" "}
                      siswa
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowRankModal(false)}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition"
                >
                  Tutup
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes rankReveal {
          from {
            opacity: 0;
            filter: blur(6px);
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: scale(1);
          }
        }
        @keyframes rankSubReveal {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes revealSweep {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }
        .animate-rankReveal {
          animation: rankReveal 0.8s ease-out forwards;
        }
        .animate-rankSubReveal {
          animation: rankSubReveal 0.5s ease-out forwards;
          animation-delay: 0.3s;
        }
        .animate-revealSweep {
          animation: revealSweep 1.2s ease-in-out;
        }
      `}</style>
    </>
  );
};





  const TableCatatanWali = () => (
    <div className="bg-white shadow rounded-lg mt-6">
      <h2 className="text-lg font-semibold text-black p-4 border-b">
        📝 Catatan Wali Kelas
      </h2>
      <div className="p-5">
        <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-800 leading-relaxed">
          {rap.catatan_wali && String(rap.catatan_wali).trim() !== ""
            ? rap.catatan_wali
            : "— (Belum ada catatan dari wali kelas)"}
        </div>
      </div>
    </div>
  );

  const biodata = {
    nisn: rap.nisn || "-",
    nama: rap.nama_siswa || "-",
    kelas: rap.kelas || "-",
    semester: rap.semester || "-",
    tahun: rap.tahun_pelajaran || "-",
    fase: rap.fase || "-",
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-6 text-center">
          📚 Rapor Siswa
        </h1>

        {/* Kop / Biodata Siswa – disamakan dengan kop umum (tanpa gambar) */}
        <div className="bg-white shadow rounded-lg p-6 mb-6 text-black">
          <div className="mt-3 text-sm leading-snug">
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-y-3 md:gap-y-1 md:gap-x-16">
              {/* Kolom kiri */}
              <div className="space-y-1">
                <div className="flex">
                  <span className="w-32 md:w-36">Nama</span>
                  <span className="w-4 text-center">:</span>
                  <span className="font-semibold">{biodata.nama}</span>
                </div>
                <div className="flex">
                  <span className="w-32 md:w-36">NIS/NISN</span>
                  <span className="w-4 text-center">:</span>
                  <span>- / {biodata.nisn}</span>
                </div>
                <div className="flex">
                  <span className="w-32 md:w-36">Nama Sekolah</span>
                  <span className="w-4 text-center">:</span>
                  <span className="break-words">
                    {bio?.nama_sekolah || "—"}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-32 md:w-36">Alamat</span>
                  <span className="w-4 text-center">:</span>
                  <span className="break-words">
                    {bio?.alamat || "—"}
                  </span>
                </div>
              </div>

              {/* Kolom kanan */}
              <div className="space-y-1">
                <div className="flex">
                  <span className="w-28 md:w-32">Kelas</span>
                  <span className="w-4 text-center">:</span>
                  <span className="font-semibold">{biodata.kelas}</span>
                </div>
                <div className="flex">
                  <span className="w-28 md:w-32">Semester</span>
                  <span className="w-4 text-center">:</span>
                  {/* ambil dulu yang umum dari bio */}
                  <span>{bio?.semesterUmum || biodata.semester || "-"}</span>
                </div>
                <div className="flex">
                  <span className="w-28 md:w-32">Fase</span>
                  <span className="w-4 text-center">:</span>
                 <span>{resolveFase(biodata.kelas, bio?.fase || biodata.fase)}</span>
                </div>
                <div className="flex">
                  <span className="w-28 md:w-32">Tahun Pelajaran</span>
                  <span className="w-4 text-center">:</span>
                  {/* ambil dulu yang umum dari bio */}
                  <span>
                    {bio?.tahunPelajaranUmum || biodata.tahun || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Garis pemisah ala kop rapor */}
            <div className="border-b border-gray-300 mt-3" />
          </div>
        </div>

        <TableUmum />
        <TablePondok />
        <TableHafalan />
        <TableAbsensi />
        <TablePoinPelanggaran />
        {/* <TableRanking /> */}
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