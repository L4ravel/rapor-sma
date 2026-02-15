"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";




/* ===== Helpers ===== */
const nonEmpty = (v) => !(v === undefined || v === null || String(v).trim() === "");
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const avg = (nums) => {
  const vals = nums.filter((x) => Number.isFinite(x));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

const safeOrder = async (colName) => {
  try {
    return await getDocs(query(collection(db, colName), orderBy("createdAt", "asc")));
  } catch {
    return await getDocs(collection(db, colName));
  }
};
function appliesToClass(docData, kelas) {
  const k = docData?.kelas;
  if (!kelas || !k) return false;
  if (Array.isArray(k)) return k.includes(kelas);
  const tokens = String(k)
    .split(/[^A-Za-z0-9]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return tokens.includes(String(kelas).trim());
}

import * as XLSX from "xlsx";

function downloadXLS(filename, sheetName, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws["!ref"]);

  // ===== HEADER =====
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (!cell) continue;

    cell.s = {
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

  // ===== BODY =====
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (!cell) continue;

      const isNumber = typeof cell.v === "number";

      cell.s = {
        alignment: {
          horizontal: isNumber ? "center" : "left",
          vertical: "center",
        },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
        numFmt: isNumber ? "0" : undefined,
      };
    }
  }

  // ===== AUTO WIDTH =====
  ws["!cols"] = rows[0].map((_, i) => ({
    wch: Math.max(
      ...rows.map((r) => String(r[i] ?? "").length),
      10
    ),
  }));

  // ===== FREEZE HEADER =====
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}






// --- safeKey & readers (cek original name + safeKey UPPERCASE) ---
const safeKey = (name) =>
  String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_") // 🔥 ini kuncinya
    .replace(/_+/g, "_")
    .trim();

// baca flat value: coba r[orig], lalu r[SAFE]
const readFlat = (rObj, mapelName) => {
  if (!rObj) return undefined;

  // 1. nama asli (jarang kepakai)
  if (rObj[mapelName] !== undefined) return rObj[mapelName];

  // 2. format Firestore kamu: Siroh_Tarikh
  const key1 = mapelName.replace(/[^A-Za-z0-9]/g, "_");
  if (rObj[key1] !== undefined) return rObj[key1];

  // 3. fallback uppercase (jaga-jaga legacy)
  const key2 = key1.toUpperCase();
  if (rObj[key2] !== undefined) return rObj[key2];

  return undefined;
};

// baca nested pondok: coba r.pondok[orig] lalu r.pondok[SAFE]
const readPondok = (rObj, mapelName) => {
  if (!rObj) return undefined;
  const pondok = rObj.pondok || {};
  if (pondok[mapelName] !== undefined) return pondok[mapelName];
  const sk = safeKey(mapelName);
  return pondok[sk];
};

function toCSV(rows) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    )
    .join("\n");
}
function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ===== Mapel shortener (singkatan) ===== */
const MAPEL_DICT = {
  "Pendidikan Agama Islam dan Budi Pekerti": "PAI",
  "Pendidikan Pancasila": "PPKn",
  "Bahasa Indonesia": "B. Indo",
  "Bahasa Inggris": "B. Ing",
  "Matematika (Umum)": "Mtk",
  "Matematika": "Mat",
  "Ilmu Pengetahuan Alam (IPA)": "IPA",
  "Ilmu Pengetahuan Sosial (IPS)": "IPS",
  Informatika: "Inf",
  "Seni dan Budaya": "Seni B.",
  "Muatan Lokal": "Mulok",
  "Pendidikan Jasmani, Olahraga, dan Kesehatan": "PJOK",
};
const STOPWORDS = new Set([
  "dan","yang","untuk","pada","di","ke","dari","dengan","serta","atau","oleh","&","/","-","kelas",
]);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);
function shortenAuto(full) {
  const noParen = String(full).replace(/\(.*?\)/g, " ");
  const words = noParen
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return full;
  const chopped = words.map((w) => cap(w.slice(0, 3)));
  let out = chopped.join(" ");
  if (out.length <= 16) return out;
  const acronym = words.map((w) => w[0]).join("").toUpperCase();
  return acronym;
}
function shortenMapel(name) {
  if (!name) return "";
  const key = String(name).trim();
  if (MAPEL_DICT[key]) return MAPEL_DICT[key];
  return shortenAuto(key);
}

/* ===== UI small parts ===== */
function Section({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
        <div className="font-semibold text-slate-800">{title}</div>
        <div className="flex gap-2">{right}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function LegerKelasPage() {
  const { kelas } = useParams(); // [kelas] dari URL
  const [loading, setLoading] = useState(true);

  const [siswa, setSiswa] = useState([]);          // siswa kelas ini
  const [raporMap, setRaporMap] = useState({});    // {nisn: rapor}
  const [umumCols, setUmumCols] = useState([]);    // array nama mapel umum utk kelas
  const [pondokCols, setPondokCols] = useState([]);// array nama mapel pondok utk kelas

  // Load mapel utk kelas dari koleksi mapel_umum & mapel_pondok + siswa + rapor
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [um, pd] = await Promise.all([safeOrder("mapel_umum"), safeOrder("mapel_pondok")]);
        const umum = um.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((m) => appliesToClass(m, kelas))
          .map((m) => m.nama);
        const pondok = pd.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((m) => appliesToClass(m, kelas))
          .map((m) => m.nama);
        setUmumCols(umum);
        setPondokCols(pondok);

        const sSnap = await getDocs(collection(db, "siswa"));
        const sAll = sSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        setSiswa(sAll.filter((s) => s.kelas === kelas));

        const rSnap = await getDocs(collection(db, "raport"));
        const map = {};
        rSnap.docs.forEach((d) => (map[d.id] = d.data() || {}));
        setRaporMap(map);
      } finally {
        setLoading(false);
      }
    })();
  }, [kelas]);

  /* ===== Hitung tabel dasar & METRIK sinkron (absensi, rerata, total, rank) ===== */
  const { tabelUmum, tabelPondok, metricsByNisn, rankByNisn } = useMemo(() => {
    const getAvg = (r, cols, isPondok = false) => {
  const vals = cols
    .map((name) => {
      if (isPondok) {
        // coba nested pondok (obj or value), lalu flat
        const nested = readPondok(r, name);
        if (nested !== undefined) {
          // nested bisa berupa { nilai: 88 } atau langsung angka/string
          if (nested && nested.hasOwnProperty("nilai")) return toNum(nested.nilai);
          if (nonEmpty(nested)) return toNum(nested);
        }
        const flat = readFlat(r, name);
        return nonEmpty(flat) ? toNum(flat) : NaN;
      } else {
        const flat = readFlat(r, name);
        return nonEmpty(flat) ? toNum(flat) : NaN;
      }
    })
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

    const makeRow = (s, i, cols, isPondok = false) => {
  const r = raporMap[s.nisn] || {};
  const nilaiArr = cols.map((mName) => {
    if (isPondok) {
      // cek nested pondok (orig / safe)
      const nested = readPondok(r, mName);
      if (nested !== undefined) {
        if (nested && nested.hasOwnProperty("nilai")) return nested.nilai;
        if (nonEmpty(nested)) return nested;
      }
      
      // fallback flat (orig / safe)
      const flat = readFlat(r, mName);
      return nonEmpty(flat) ? flat : "";
    } else {
      const flat = readFlat(r, mName);
      return nonEmpty(flat) ? flat : "";
    }
  });

  return {
    no: i + 1,
    nisn: s.nisn || "",
    nama: s.nama_siswa || "",
    nilai: nilaiArr,
  };
};

    const tUmum = siswa.map((s, i) => makeRow(s, i, umumCols, false));
const tPondok = siswa.map((s, i) => makeRow(s, i, pondokCols, true));

    const metrics = {};
    siswa.forEach((s) => {
      const r = raporMap[s.nisn] || {};
      const sakit = toNum(r.sakit);
      const izin  = toNum(r.izin);
      const alpha = toNum(r.alpha);
      const avgUmum   = umumCols.length   ? getAvg(r, umumCols, false) : 0;
const avgPondok = pondokCols.length ? getAvg(r, pondokCols, true)  : 0;

      metrics[s.nisn] = {
        absensi: `${sakit}/${izin}/${alpha}`,
        avgUmum,
        avgPondok,
        total: avgUmum + avgPondok,
      };
    });

    const totals = siswa.map((s) => metrics[s.nisn]?.total ?? 0);
    const sortedUnique = Array.from(new Set(totals.slice().sort((a, b) => b - a)));
    const rankMap = {};
    sortedUnique.forEach((val, idx) => (rankMap[val] = idx + 1));

    const rank = {};
    siswa.forEach((s) => (rank[s.nisn] = rankMap[metrics[s.nisn]?.total ?? 0]));

    return { tabelUmum: tUmum, tabelPondok: tPondok, metricsByNisn: metrics, rankByNisn: rank };
  }, [siswa, raporMap, umumCols, pondokCols]);

  /* ===== Download CSV (ikut kolom metrik) ===== */
  const downloadUmum = () => {
    const header = ["No", "NISN", "Nama", ...umumCols, "Absensi (S/I/A)", "Rerata Umum", "Rerata Pondok", "Jumlah", "Rangking"];
    const rows = tabelUmum.map((row) => {
      const m = metricsByNisn[row.nisn] || {};
      return [
        row.no,
        row.nisn,
        row.nama,
        ...row.nilai,
        m.absensi || "0/0/0",
        (m.avgUmum ?? 0).toFixed(1),
        (m.avgPondok ?? 0).toFixed(1),
        (m.total ?? 0).toFixed(1),
        rankByNisn[row.nisn] ?? "",
      ];
    });
    downloadXLS(
  `leger-umum-${kelas}.xlsx`,
  "Leger Umum",
  [header, ...rows]
);
  };
  const downloadPondok = () => {
    const header = ["No", "NISN", "Nama", ...pondokCols, "Absensi (S/I/A)", "Rerata Umum", "Rerata Pondok", "Jumlah", "Rangking"];
    const rows = tabelPondok.map((row) => {
      const m = metricsByNisn[row.nisn] || {};
      return [
        row.no,
        row.nisn,
        row.nama,
        ...row.nilai,
        m.absensi || "0/0/0",
        (m.avgUmum ?? 0).toFixed(1),
        (m.avgPondok ?? 0).toFixed(1),
        (m.total ?? 0).toFixed(1),
        rankByNisn[row.nisn] ?? "",
      ];
    });
    downloadXLS(
  `leger-pondok-${kelas}.xlsx`,
  "Leger Pondok",
  [header, ...rows]
);
  };

  /* ===== Print handlers ===== */
  const printOne = (nisn, tipe) => {
    const path =
      tipe === "umum"
        ? `/rapor-siswa/${nisn}/cetak-umum`
        : `/rapor-siswa/${nisn}/cetak-pondok`;
    window.open(path, "_blank", "noopener,noreferrer");
  };
 const printAll = (tipe) => {
   const url =
     tipe === "umum"
       ? `/rapor-siswa/print-umum/${encodeURIComponent(kelas)}`
      : `/rapor-siswa/print-pondok/${encodeURIComponent(kelas)}`;
  window.open(url, "_blank", "noopener,noreferrer");
 };

  /* ====== Styling kolom ====== */
  const tableBase = "table-fixed w-full border border-slate-300 text-sm";
  const thBase = "border border-slate-300 px-2 py-1";
  const tdBase = "border border-slate-300 px-2 py-1";

  const thMapel = `${thBase} w-14 max-w-14 whitespace-normal break-words leading-tight text-[11px] text-center`;
  const tdMapel = `${tdBase} w-14 max-w-14 whitespace-nowrap overflow-hidden text-ellipsis text-center`;

  const thNama = `${thBase} w-[360px]`;
  const tdNama = `${tdBase} w-[360px] whitespace-nowrap`;

  const thAbs = `${thBase} w-24 text-center`;
  const tdAbs = `${tdBase} w-24 text-center`;

  const thAvg = `${thBase} w-20 text-center`;
  const tdAvg = `${tdBase} w-20 text-center`;

  const thTot = `${thBase} w-20 text-center`;
  const tdTot = `${tdBase} w-20 text-center`;

  const thRank = `${thBase} w-16 text-center`;
  const tdRank = `${tdBase} w-16 text-center font-semibold`;

  const thPrint = `${thBase} w-20 text-center`;
  const tdPrint = `${tdBase} w-20 text-center`;

  return (
     <div className="min-h-screen bg-slate-100 text-black">
    <div className="w-full px-3 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Leger Nilai — Kelas {kelas}
          </h1>
          <p className="text-slate-600 mt-1">
            Semua siswa pada kelas ini. Gunakan tombol download/print untuk ekspor.
          </p>
        </div>

        {loading ? (
          <div className="p-6 bg-white rounded-xl border border-slate-200">⏳ Memuat data…</div>
        ) : (
          <>
            {/* ===== Leger Umum ===== */}
            <Section
              title="📘 Leger Nilai Umum"
              right={
  <>
    {/* CETAK COVER */}
    <button
      onClick={() =>
        window.open(`/cover/${encodeURIComponent(kelas)}`, "_blank")
      }
      className="px-3 py-2 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600"
    >
      Cetak Cover
    </button>

    {/* PRINT SEMUA MAPEL UMUM */}
    <button
      onClick={() => printAll("umum")}
      className="px-3 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700"
      disabled={!siswa.length}
    >
      Print Semua
    </button>

    {/* DOWNLOAD EXCEL */}
    <button
      onClick={downloadUmum}
      className="px-3 py-2 rounded-md text-sm bg-slate-900 text-white hover:bg-slate-800"
      disabled={umumCols.length === 0}
    >
      Download Excel
    </button>
  </>
              }
            >
              {umumCols.length === 0 ? (
                <div className="text-slate-500">Tidak ada mapel umum untuk kelas ini.</div>
              ) : (
                <div className="overflow-auto">
                  <table className={tableBase}>
                    <thead>
                      <tr className="bg-indigo-50">
                        <th className={`${thBase} w-12 text-center`}>No</th>
                        <th className={`${thBase} w-32`}>NISN</th>
                        <th className={thNama}>Nama</th>
                        {umumCols.map((m, i) => {
                          const short = shortenMapel(m);
                          return (
                            <th key={`hu-${i}`} className={thMapel} title={m}>
                              {short}
                            </th>
                          );
                        })}
                        <th className={thAbs}>Absensi (S/I/A)</th>
                        <th className={thAvg}>Rerata Umum</th>
                        <th className={thAvg}>Rerata Pondok</th>
                        <th className={thTot}>Jumlah</th>
                        <th className={thRank}>Rangking</th>
                        <th className={thPrint}>Print</th>
                      </tr>
                    </thead>
                    <tbody>
  {tabelUmum
    .slice()
    .sort(
      (a, b) =>
        (rankByNisn[a.nisn] ?? 9999) - (rankByNisn[b.nisn] ?? 9999)
    )
    .map((row, i) => {
      const m = metricsByNisn[row.nisn] || {};
      return (
        <tr
          key={`ru-${i}`}
          className={i % 2 ? "bg-white" : "bg-slate-50/50"}
        >
          {/* No sekarang ikut urutan ranking */}
          <td className={`${tdBase} text-center`}>{i + 1}</td>
          <td className={tdBase}>{row.nisn}</td>
          <td className={tdNama}>{row.nama}</td>
          {row.nilai.map((v, j) => (
            <td key={`rvu-${i}-${j}`} className={tdMapel}>
              {v}
            </td>
          ))}
          <td className={tdAbs}>{m.absensi || "0/0/0"}</td>
          <td className={tdAvg}>{(m.avgUmum ?? 0).toFixed(1)}</td>
          <td className={tdAvg}>{(m.avgPondok ?? 0).toFixed(1)}</td>
          <td className={tdTot}>{(m.total ?? 0).toFixed(1)}</td>
          <td className={tdRank}>{rankByNisn[row.nisn] ?? ""}</td>
          <td className={tdPrint}>
            <button
              onClick={() => printOne(row.nisn, "umum")}
              className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              title="Cetak Rapor Umum"
            >
              Print
            </button>
          </td>
        </tr>
      );
    })}
</tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ===== Leger Pondok ===== */}
            <div className="h-6" />
            <Section
              title="📗 Leger Nilai Pondok"
              right={
                <>
                  <button
                    onClick={() => printAll("pondok")}
                    className="px-3 py-2 rounded-md text-sm bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={!siswa.length}
                  >
                    Print Semua
                  </button>
                  <button
                    onClick={downloadPondok}
                    className="px-3 py-2 rounded-md text-sm bg-slate-900 text-white hover:bg-slate-800"
                    disabled={pondokCols.length === 0}
                  >
                    Download Excel
                  </button>
                </>
              }
            >
              {pondokCols.length === 0 ? (
                <div className="text-slate-500">Tidak ada mapel pondok untuk kelas ini.</div>
              ) : (
                <div className="overflow-auto">
                  <table className={tableBase}>
                    <thead>
                      <tr className="bg-emerald-50">
                        <th className={`${thBase} w-12 text-center`}>No</th>
                        <th className={`${thBase} w-32`}>NISN</th>
                        <th className={thNama}>Nama</th>
                        {pondokCols.map((m, i) => {
                          const short = shortenMapel(m);
                          return (
                            <th key={`hp-${i}`} className={thMapel} title={m}>
                              {short}
                            </th>
                          );
                        })}
                        <th className={thAbs}>Absensi (S/I/A)</th>
                        <th className={thAvg}>Rerata Umum</th>
                        <th className={thAvg}>Rerata Pondok</th>
                        <th className={thTot}>Jumlah</th>
                        <th className={thRank}>Rangking</th>
                        <th className={thPrint}>Print</th>
                      </tr>
                    </thead>
                    <tbody>
  {tabelPondok
    .slice()
    .sort(
      (a, b) =>
        (rankByNisn[a.nisn] ?? 9999) - (rankByNisn[b.nisn] ?? 9999)
    )
    .map((row, i) => {
      const m = metricsByNisn[row.nisn] || {};
      return (
        <tr
          key={`rp-${i}`}
          className={i % 2 ? "bg-white" : "bg-slate-50/50"}
        >
          {/* No ikut urutan ranking */}
          <td className={`${tdBase} text-center`}>{i + 1}</td>
          <td className={tdBase}>{row.nisn}</td>
          <td className={tdNama}>{row.nama}</td>
          {row.nilai.map((v, j) => (
            <td key={`rvp-${i}-${j}`} className={tdMapel}>
              {v}
            </td>
          ))}
          <td className={tdAbs}>{m.absensi || "0/0/0"}</td>
          <td className={tdAvg}>{(m.avgUmum ?? 0).toFixed(1)}</td>
          <td className={tdAvg}>{(m.avgPondok ?? 0).toFixed(1)}</td>
          <td className={tdTot}>{(m.total ?? 0).toFixed(1)}</td>
          <td className={tdRank}>{rankByNisn[row.nisn] ?? ""}</td>
          <td className={tdPrint}>
            <button
              onClick={() => printOne(row.nisn, "pondok")}
              className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              title="Cetak Rapor Pondok"
            >
              Print
            </button>
          </td>
        </tr>
      );
    })}
</tbody>

                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}