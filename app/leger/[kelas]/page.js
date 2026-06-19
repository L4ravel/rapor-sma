"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import * as XLSX from "xlsx";

/* ===== Helpers ===== */
const nonEmpty = (v) =>
  !(v === undefined || v === null || String(v).trim() === "");

const toNum = (v) => {
  if (v === null || v === undefined) return NaN;

  if (typeof v === "number") {
    return Number.isFinite(v) ? v : NaN;
  }

  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  if (typeof v === "object") {
    if (v.nilai !== undefined) return toNum(v.nilai);
    if (v.value !== undefined) return toNum(v.value);
  }

  return NaN;
};

const avg = (nums) => {
  const vals = nums.filter((x) => Number.isFinite(x));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

const safeOrder = async (colName) => {
  try {
    return await getDocs(
      query(collection(db, colName), orderBy("createdAt", "asc"))
    );
  } catch {
    return await getDocs(collection(db, colName));
  }
};

function appliesToClass(docData, kelas) {
  const k = docData?.kelas;
  if (!kelas || !k) return false;

  const kelasTarget = String(kelas).trim();

  if (Array.isArray(k)) {
    return k.map((x) => String(x).trim()).includes(kelasTarget);
  }

  const raw = String(k).trim();

  if (raw === kelasTarget) return true;

  const tokens = raw
    .split(/[^A-Za-z0-9]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return tokens.includes(kelasTarget);
}

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
    wch: Math.max(...rows.map((r) => String(r[i] ?? "").length), 10),
  }));

  // ===== FREEZE HEADER =====
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// --- safeKey & readers ---
const safeKey = (name) =>
  String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

const mixedSafeKey = (name) =>
  String(name || "")
    .replace(/[^A-Za-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

const compactKey = (name) => safeKey(name).replace(/_/g, "");

function extractNilai(v) {
  if (v === undefined || v === null) return undefined;

  if (typeof v === "object") {
    if (v.nilai !== undefined) return v.nilai;
    if (v.value !== undefined) return v.value;
  }

  return v;
}

function findByFlexibleKey(obj, mapelName) {
  if (!obj) return undefined;

  const original = String(mapelName || "").trim();
  const keyMixed = mixedSafeKey(original);
  const keyUpper = safeKey(original);
  const keyLower = keyMixed.toLowerCase();
  const targetCompact = compactKey(original);

  const candidates = [
    original,
    keyMixed,
    keyUpper,
    keyLower,
    keyMixed.replace(/_/g, " "),
    keyUpper.replace(/_/g, " "),
  ].filter(Boolean);

  for (const key of candidates) {
    if (obj[key] !== undefined) return obj[key];
  }

  // Case-insensitive dan aman untuk kasus:
  // "Siroh/Tarikh Mustawa 4"
  // "Siroh_Tarikh_Mustawa_4"
  // "SIROH_TARIKH_MUSTAWA_4"
  // "siroh_tarikh_mustawa_4"
  const foundKey = Object.keys(obj).find((k) => {
    const kSafe = safeKey(k);
    const kCompact = compactKey(k);

    return kSafe === keyUpper || kCompact === targetCompact;
  });

  if (foundKey) return obj[foundKey];

  return undefined;
}

// baca flat value: coba original, safe mixed, safe uppercase, case-insensitive
const readFlat = (rObj, mapelName) => {
  if (!rObj) return undefined;
  return extractNilai(findByFlexibleKey(rObj, mapelName));
};

// baca nested pondok: coba r.pondok[orig], r.pondok[Siroh_Tarikh...], r.pondok[SIROH_TARIKH...]
const readPondok = (rObj, mapelName) => {
  if (!rObj) return undefined;

  const pondok = rObj.pondok || {};
  const nested = findByFlexibleKey(pondok, mapelName);

  return extractNilai(nested);
};

/* ===== Mapel shortener (singkatan) ===== */
const MAPEL_DICT = {
  "Pendidikan Agama Islam dan Budi Pekerti": "PAI",
  "Pendidikan Pancasila": "PPKn",
  "Bahasa Indonesia": "B. Indo",
  "Bahasa Inggris": "B. Ing",
  "Matematika (Umum)": "Mtk",
  Matematika: "Mat",
  "Ilmu Pengetahuan Alam (IPA)": "IPA",
  "Ilmu Pengetahuan Sosial (IPS)": "IPS",
  Informatika: "Inf",
  "Seni dan Budaya": "Seni B.",
  "Muatan Lokal": "Mulok",
  "Pendidikan Jasmani, Olahraga, dan Kesehatan": "PJOK",
  "Siroh/Tarikh Mustawa 4": "Siroh 4",
};

const STOPWORDS = new Set([
  "dan",
  "yang",
  "untuk",
  "pada",
  "di",
  "ke",
  "dari",
  "dengan",
  "serta",
  "atau",
  "oleh",
  "&",
  "/",
  "-",
  "kelas",
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
  const { kelas } = useParams();
  const [loading, setLoading] = useState(true);

  const [siswa, setSiswa] = useState([]);
  const [raporMap, setRaporMap] = useState({});
  const [umumCols, setUmumCols] = useState([]);
  const [pondokCols, setPondokCols] = useState([]);

  // Load mapel utk kelas dari koleksi mapel_umum & mapel_pondok + siswa + rapor
  useEffect(() => {
    (async () => {
      setLoading(true);

      try {
        const [um, pd] = await Promise.all([
          safeOrder("mapel_umum"),
          safeOrder("mapel_pondok"),
        ]);

        const umum = um.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((m) => appliesToClass(m, kelas))
          .map((m) => m.nama)
          .filter(Boolean);

        const pondok = pd.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((m) => appliesToClass(m, kelas))
          .map((m) => m.nama)
          .filter(Boolean);

        setUmumCols(umum);
        setPondokCols(pondok);

        const sSnap = await getDocs(collection(db, "siswa"));
        const sAll = sSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }));

        setSiswa(
          sAll
            .filter((s) => String(s.kelas || "") === String(kelas || ""))
            .sort((a, b) =>
              String(a.nama_siswa || "").localeCompare(
                String(b.nama_siswa || ""),
                "id"
              )
            )
        );

        const rSnap = await getDocs(collection(db, "raport"));
        const map = {};

        rSnap.docs.forEach((d) => {
          const data = d.data() || {};
          map[d.id] = data;

          if (data.nisn) {
            map[String(data.nisn)] = data;
          }
        });

        setRaporMap(map);
      } catch (e) {
        console.error("Gagal memuat data leger:", e);
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
            // coba nested pondok, lalu flat
            const nested = readPondok(r, name);
            if (nonEmpty(nested)) return toNum(nested);

            const flat = readFlat(r, name);
            return nonEmpty(flat) ? toNum(flat) : NaN;
          }

          const flat = readFlat(r, name);
          return nonEmpty(flat) ? toNum(flat) : NaN;
        })
        .filter((n) => Number.isFinite(n));

      return avg(vals);
    };

    const makeRow = (s, i, cols, isPondok = false) => {
      const r = raporMap[s.nisn] || {};

      const nilaiArr = cols.map((mName) => {
        if (isPondok) {
          const nested = readPondok(r, mName);
          if (nonEmpty(nested)) return nested;

          const flat = readFlat(r, mName);
          return nonEmpty(flat) ? flat : "";
        }

        const flat = readFlat(r, mName);
        return nonEmpty(flat) ? flat : "";
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

      const sakit = Number.isFinite(toNum(r.sakit)) ? toNum(r.sakit) : 0;
      const izin = Number.isFinite(toNum(r.izin)) ? toNum(r.izin) : 0;
      const alpha = Number.isFinite(toNum(r.alpha)) ? toNum(r.alpha) : 0;

      const avgUmum = umumCols.length ? getAvg(r, umumCols, false) : 0;
      const avgPondok = pondokCols.length ? getAvg(r, pondokCols, true) : 0;

      metrics[s.nisn] = {
        absensi: `${sakit}/${izin}/${alpha}`,
        avgUmum,
        avgPondok,
        total: avgUmum + avgPondok,
      };
    });

    const totals = siswa.map((s) => metrics[s.nisn]?.total ?? 0);
    const sortedUnique = Array.from(
      new Set(totals.slice().sort((a, b) => b - a))
    );

    const rankMap = {};
    sortedUnique.forEach((val, idx) => {
      rankMap[val] = idx + 1;
    });

    const rank = {};
    siswa.forEach((s) => {
      rank[s.nisn] = rankMap[metrics[s.nisn]?.total ?? 0];
    });

    return {
      tabelUmum: tUmum,
      tabelPondok: tPondok,
      metricsByNisn: metrics,
      rankByNisn: rank,
    };
  }, [siswa, raporMap, umumCols, pondokCols]);

  /* ===== Download Excel ===== */
  const downloadUmum = () => {
    const sortedRows = tabelUmum
      .slice()
      .sort(
        (a, b) =>
          (rankByNisn[a.nisn] ?? 9999) -
          (rankByNisn[b.nisn] ?? 9999)
      );

    const header = [
      "No",
      "NISN",
      "Nama",
      ...umumCols,
      "Absensi (S/I/A)",
      "Rerata Umum",
      "Rerata Pondok",
      "Jumlah",
      "Rangking",
    ];

    const rows = sortedRows.map((row, i) => {
      const m = metricsByNisn[row.nisn] || {};

      return [
        i + 1,
        row.nisn,
        row.nama,
        ...row.nilai,
        m.absensi || "0/0/0",
        Number(m.avgUmum ?? 0).toFixed(1),
        Number(m.avgPondok ?? 0).toFixed(1),
        Number(m.total ?? 0).toFixed(1),
        rankByNisn[row.nisn] ?? "",
      ];
    });

    downloadXLS(`leger-umum-${kelas}.xlsx`, "Leger Umum", [
      header,
      ...rows,
    ]);
  };

  const downloadPondok = () => {
    const sortedRows = tabelPondok
      .slice()
      .sort(
        (a, b) =>
          (rankByNisn[a.nisn] ?? 9999) -
          (rankByNisn[b.nisn] ?? 9999)
      );

    const header = [
      "No",
      "NISN",
      "Nama",
      ...pondokCols,
      "Absensi (S/I/A)",
      "Rerata Umum",
      "Rerata Pondok",
      "Jumlah",
      "Rangking",
    ];

    const rows = sortedRows.map((row, i) => {
      const m = metricsByNisn[row.nisn] || {};

      return [
        i + 1,
        row.nisn,
        row.nama,
        ...row.nilai,
        m.absensi || "0/0/0",
        Number(m.avgUmum ?? 0).toFixed(1),
        Number(m.avgPondok ?? 0).toFixed(1),
        Number(m.total ?? 0).toFixed(1),
        rankByNisn[row.nisn] ?? "",
      ];
    });

    downloadXLS(`leger-pondok-${kelas}.xlsx`, "Leger Pondok", [
      header,
      ...rows,
    ]);
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

  const thMapel =
    `${thBase} w-14 max-w-14 whitespace-normal break-words leading-tight text-[11px] text-center`;
  const tdMapel =
    `${tdBase} w-14 max-w-14 whitespace-nowrap overflow-hidden text-ellipsis text-center`;

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

  const sortedUmumRows = tabelUmum
    .slice()
    .sort(
      (a, b) =>
        (rankByNisn[a.nisn] ?? 9999) -
        (rankByNisn[b.nisn] ?? 9999)
    );

  const sortedPondokRows = tabelPondok
    .slice()
    .sort(
      (a, b) =>
        (rankByNisn[a.nisn] ?? 9999) -
        (rankByNisn[b.nisn] ?? 9999)
    );

  return (
    <div className="min-h-screen bg-slate-100 text-black">
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Leger Nilai — Kelas {kelas}
          </h1>
          <p className="text-slate-600 mt-1">
            Semua siswa pada kelas ini. Gunakan tombol download/print untuk
            ekspor.
          </p>
        </div>

        {loading ? (
          <div className="p-6 bg-white rounded-xl border border-slate-200">
            ⏳ Memuat data…
          </div>
        ) : (
          <>
            {/* ===== Leger Umum ===== */}
            <Section
              title="📘 Leger Nilai Umum"
              right={
                <>
                  <button
                    onClick={() =>
                      window.open(
                        `/cover/${encodeURIComponent(kelas)}`,
                        "_blank"
                      )
                    }
                    className="px-3 py-2 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600"
                  >
                    Cetak Cover
                  </button>

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
                    Download Excel
                  </button>
                </>
              }
            >
              {umumCols.length === 0 ? (
                <div className="text-slate-500">
                  Tidak ada mapel umum untuk kelas ini.
                </div>
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
                      {sortedUmumRows.map((row, i) => {
                        const m = metricsByNisn[row.nisn] || {};

                        return (
                          <tr
                            key={`ru-${row.nisn}-${i}`}
                            className={i % 2 ? "bg-white" : "bg-slate-50/50"}
                          >
                            <td className={`${tdBase} text-center`}>
                              {i + 1}
                            </td>
                            <td className={tdBase}>{row.nisn}</td>
                            <td className={tdNama}>{row.nama}</td>

                            {row.nilai.map((v, j) => (
                              <td key={`rvu-${i}-${j}`} className={tdMapel}>
                                {v}
                              </td>
                            ))}

                            <td className={tdAbs}>{m.absensi || "0/0/0"}</td>
                            <td className={tdAvg}>
                              {Number(m.avgUmum ?? 0).toFixed(1)}
                            </td>
                            <td className={tdAvg}>
                              {Number(m.avgPondok ?? 0).toFixed(1)}
                            </td>
                            <td className={tdTot}>
                              {Number(m.total ?? 0).toFixed(1)}
                            </td>
                            <td className={tdRank}>
                              {rankByNisn[row.nisn] ?? ""}
                            </td>
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

                      {sortedUmumRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={umumCols.length + 9}
                            className="text-center p-4 text-slate-500 border border-slate-300"
                          >
                            Tidak ada siswa pada kelas ini.
                          </td>
                        </tr>
                      )}
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
                <div className="text-slate-500">
                  Tidak ada mapel pondok untuk kelas ini.
                </div>
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
                      {sortedPondokRows.map((row, i) => {
                        const m = metricsByNisn[row.nisn] || {};

                        return (
                          <tr
                            key={`rp-${row.nisn}-${i}`}
                            className={i % 2 ? "bg-white" : "bg-slate-50/50"}
                          >
                            <td className={`${tdBase} text-center`}>
                              {i + 1}
                            </td>
                            <td className={tdBase}>{row.nisn}</td>
                            <td className={tdNama}>{row.nama}</td>

                            {row.nilai.map((v, j) => (
                              <td key={`rvp-${i}-${j}`} className={tdMapel}>
                                {v}
                              </td>
                            ))}

                            <td className={tdAbs}>{m.absensi || "0/0/0"}</td>
                            <td className={tdAvg}>
                              {Number(m.avgUmum ?? 0).toFixed(1)}
                            </td>
                            <td className={tdAvg}>
                              {Number(m.avgPondok ?? 0).toFixed(1)}
                            </td>
                            <td className={tdTot}>
                              {Number(m.total ?? 0).toFixed(1)}
                            </td>
                            <td className={tdRank}>
                              {rankByNisn[row.nisn] ?? ""}
                            </td>
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

                      {sortedPondokRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={pondokCols.length + 9}
                            className="text-center p-4 text-slate-500 border border-slate-300"
                          >
                            Tidak ada siswa pada kelas ini.
                          </td>
                        </tr>
                      )}
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