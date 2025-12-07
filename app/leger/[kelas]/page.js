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
    const getAvg = (r, cols) => {
      const vals = cols
        .map((name) => r?.[name])
        .filter((v) => nonEmpty(v))
        .map((v) => toNum(v))
        .filter((n) => Number.isFinite(n));
      if (!vals.length) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const makeRow = (s, i, cols) => {
      const r = raporMap[s.nisn] || {};
      return {
        no: i + 1,
        nisn: s.nisn || "",
        nama: s.nama_siswa || "",
        nilai: cols.map((mName) => (nonEmpty(r[mName]) ? r[mName] : "")),
      };
    };

    const tUmum = siswa.map((s, i) => makeRow(s, i, umumCols));
    const tPondok = siswa.map((s, i) => makeRow(s, i, pondokCols));

    const metrics = {};
    siswa.forEach((s) => {
      const r = raporMap[s.nisn] || {};
      const sakit = toNum(r.sakit);
      const izin  = toNum(r.izin);
      const alpha = toNum(r.alpha);
      const avgUmum   = umumCols.length   ? getAvg(r, umumCols)   : 0;
      const avgPondok = pondokCols.length ? getAvg(r, pondokCols) : 0;

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
    download(`leger-umum-${kelas}.csv`, toCSV([header, ...rows]));
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
    download(`leger-pondok-${kelas}.csv`, toCSV([header, ...rows]));
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
                  <button
                    onClick={() => printAll("umum")}
                    className="px-3 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-700"
                    disabled={!siswa.length}
                  >
                    Print Semua
                  </button>
                  <button
                    onClick={downloadUmum}
                    className="px-3 py-2 rounded-md text-sm bg-slate-900 text-white hover:bg-slate-800"
                    disabled={umumCols.length === 0}
                  >
                    Download CSV
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
                      {tabelUmum.map((row, i) => {
                        const m = metricsByNisn[row.nisn] || {};
                        return (
                          <tr key={`ru-${i}`} className={i % 2 ? "bg-white" : "bg-slate-50/50"}>
                            <td className={`${tdBase} text-center`}>{row.no}</td>
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
                    Download CSV
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
                      {tabelPondok.map((row, i) => {
                        const m = metricsByNisn[row.nisn] || {};
                        return (
                          <tr key={`rp-${i}`} className={i % 2 ? "bg-white" : "bg-slate-50/50"}>
                            <td className={`${tdBase} text-center`}>{row.no}</td>
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
