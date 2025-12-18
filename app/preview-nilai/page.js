"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ---------- UI ---------- */
function Card({ title, children }) {
  return (
    <div className="relative bg-white/95 border border-slate-200 rounded-3xl shadow-md overflow-hidden">
      <div className="bg-slate-900 text-white w-full px-6 py-3 text-sm md:text-base font-semibold tracking-wide rounded-t-3xl">
        {title}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
function Pill({ ok, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        ok
          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
      }`}
    >
      {children}
    </span>
  );
}

/* ---------- Helpers ---------- */
const nonEmpty = (v) =>
  !(v === undefined || v === null || String(v).trim() === "");
const uniq = (arr) => [...new Set(arr)];
const safeOrder = async (colName) => {
  try {
    return await getDocs(
      query(collection(db, colName), orderBy("createdAt", "asc"))
    );
  } catch {
    return await getDocs(collection(db, colName));
  }
};
/** cek apakah doc mapel berlaku untuk kelas X */
function appliesToClass(docData, kelas) {
  const k = docData?.kelas;
  if (!kelas || !k) return false;
  if (Array.isArray(k)) return k.includes(kelas);
  // string: bisa "10A1" atau "12B1-12B2" atau "10A1,10A2"
  const tokens = String(k)
    .split(/[^A-Za-z0-9]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return tokens.includes(String(kelas).trim());
}

// --- Firestore-safe key (UPPERCASE, "/" -> "_") ---
const safeKey = (name) =>
  String(name || "")
    .toUpperCase()
    .replace(/\//g, "_")
    .replace(/\./g, "_")
    .trim();

// baca flat value (cek original name lalu safeKey)
const readFlat = (raporObj, mapelName) => {
  if (!raporObj) return undefined;

  const clean = String(mapelName || "").trim();
  const sk = safeKey(clean);

  // 1. exact
  if (raporObj[clean] !== undefined) return raporObj[clean];

  // 2. SAFEKEY (UPPERCASE)
  if (raporObj[sk] !== undefined) return raporObj[sk];

  // 3. CASE-INSENSITIVE FALLBACK (INI KUNCINYA)
  const foundKey = Object.keys(raporObj).find(
    (k) => k.toUpperCase() === sk
  );

  return foundKey ? raporObj[foundKey] : undefined;
};


// baca nested pondok: raporObj.pondok[orig] atau raporObj.pondok[safeKey]
const readPondok = (raporObj, mapelName) => {
  if (!raporObj) return undefined;
  const pondok = raporObj.pondok || {};

  const cleanName = String(mapelName || "").trim();
  const sk = safeKey(cleanName);

  return (
    pondok[cleanName] ??
    pondok[sk]
  );
};



export default function PreviewNilaiPage() {
  const [kelasList, setKelasList] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState("");
  const [loading, setLoading] = useState(true);

  // dataset mapel untuk SEMUA kelas (nanti difilter per kelas terpilih)
  const [mapelUmum, setMapelUmum] = useState([]); // [{id,nama,kelas}]
  const [mapelPondok, setMapelPondok] = useState([]); // [{id,nama,kelas}]

  const [siswaKelas, setSiswaKelas] = useState([]); // siswa di kelas terpilih
  const [raporMap, setRaporMap] = useState({}); // {nisn: {...rapor}}
  const [progress, setProgress] = useState({
  current: 0,
  total: 0,
  percent: 0,
});
const [progressDetail, setProgressDetail] = useState({
  siswaBelumLengkap: 0,
  totalSiswa: 0,
  totalMapel: 0,
});

useEffect(() => {
  (async () => {
    if (!selectedKelas) return;
    setLoading(true);

    try {
      const sSnap = await getDocs(collection(db, "siswa"));
      const siswaAll = sSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() || {}),
      }));

      const siswaKls =
        selectedKelas === "__ALL__"
          ? siswaAll
          : siswaAll.filter((s) => s.kelas === selectedKelas);

      setSiswaKelas(siswaKls);

      const rSnap = await getDocs(collection(db, "raport"));
      const rapor = {};
      rSnap.docs.forEach((d) => (rapor[d.id] = d.data() || {}));
      setRaporMap(rapor);

      /* ================== HITUNG PROGRESS ================== */
     let total = 0;
let current = 0;

const siswaBelumLengkapSet = new Set();
const mapelSet = new Set();

siswaKls.forEach((s) => {
  const r = rapor[s.nisn] || {};
  let siswaLengkap = true;

  // === UMUM ===
  mapelUmum
    .filter((m) => appliesToClass(m, s.kelas))
    .forEach((m) => {
      mapelSet.add(m.nama);
      total++;

      const nilai = readFlat(r, m.nama);
      if (nonEmpty(nilai)) {
        current++;
      } else {
        siswaLengkap = false;
      }
    });

  // === PONDOK ===
  mapelPondok
    .filter((m) => appliesToClass(m, s.kelas))
    .forEach((m) => {
      mapelSet.add(m.nama);
      total++;

      const nested = readPondok(r, m.nama);
      const flat = readFlat(r, m.nama);

      if (
        nonEmpty(nested?.nilai) ||
        typeof flat === "number" ||
        nonEmpty(flat)
      ) {
        current++;
      } else {
        siswaLengkap = false;
      }
    });

  if (!siswaLengkap) {
    siswaBelumLengkapSet.add(s.nisn);
  }
});

setProgress({
  current,
  total,
  percent: total === 0 ? 0 : Math.round((current / total) * 100),
});

setProgressDetail({
  siswaBelumLengkap: siswaBelumLengkapSet.size,
  totalSiswa: siswaKls.length,
  totalMapel: mapelSet.size,
});
    } finally {
      setLoading(false);
    }
  })();
}, [selectedKelas, mapelUmum, mapelPondok]);


  /* ---------- Load mapel dari koleksi yang dipakai ---------- */
  useEffect(() => {
    (async () => {
      const umumSnap = await safeOrder("mapel_umum");
      setMapelUmum(
        umumSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      );

      const pondokSnap = await safeOrder("mapel_pondok");
      setMapelPondok(
        pondokSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      );
    })();
  }, []);

  /* ---------- Ambil daftar kelas dari 'siswa' ---------- */
  useEffect(() => {
    (async () => {
      const sSnap = await getDocs(collection(db, "siswa"));
      const siswaAll = sSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() || {}),
      }));
      const list = uniq(siswaAll.map((s) => s.kelas).filter(Boolean)).sort(
        (a, b) => String(a).localeCompare(String(b), "id")
      );
      setKelasList(list);
      if (!selectedKelas && list.length > 0) setSelectedKelas(list[0]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Load siswa per kelas & seluruh rapor ---------- */
  useEffect(() => {
    (async () => {
      if (!selectedKelas) return;
      setLoading(true);
      try {
        const sSnap = await getDocs(collection(db, "siswa"));
        const siswaAll = sSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() || {}),
        }));
       const siswaKls =
  selectedKelas === "__ALL__"
    ? siswaAll
    : siswaAll.filter((s) => s.kelas === selectedKelas);

setSiswaKelas(siswaKls);


        const rSnap = await getDocs(collection(db, "raport"));
        const map = {};
        rSnap.docs.forEach((d) => (map[d.id] = d.data() || {}));
        setRaporMap(map);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKelas]);

  /* ---------- Filter mapel per kelas & hitung status ---------- */
const { rowsUmum, rowsPondok } = useMemo(() => {
  // MODE SEMUA KELAS
  if (selectedKelas === "__ALL__") {
    const resultPondok = new Map(); // mapel -> Set(kelas)
    const resultUmum = new Map();

    kelasList.forEach((kelas) => {
      const siswaDiKelas = Object.values(raporMap)
        .filter((_, idx) => true); // raporMap sudah global

      const siswaKls = Object.values(raporMap).filter(
        (_, i) => true
      );

      const siswaList = siswaKelas.filter((s) => s.kelas === kelas);

      // === PONDOK ===
      mapelPondok
  .filter((m) => appliesToClass(m, kelas))
  .forEach((m) => {
        let filled = 0;
        siswaList.forEach((s) => {
          const r = raporMap[s.nisn] || {};
          const nested = readPondok(r, m.nama);
          const flat = readFlat(r, m.nama);
          if (
  nonEmpty(nested?.nilai) ||
  (typeof flat === "number" || nonEmpty(flat))
) {
  filled++;
}
        });

        if (filled < siswaList.length) {
          if (!resultPondok.has(m.nama))
            resultPondok.set(m.nama, new Set());
          resultPondok.get(m.nama).add(kelas);
        }
      });

      // === UMUM ===
      mapelUmum
  .filter((m) => appliesToClass(m, kelas))
  .forEach((m) => {
        let filled = 0;
        siswaList.forEach((s) => {
          const r = raporMap[s.nisn] || {};
          const nilai = readFlat(r, m.nama);
          if (nonEmpty(nilai)) filled++;
        });

        if (filled < siswaList.length) {
          if (!resultUmum.has(m.nama))
            resultUmum.set(m.nama, new Set());
          resultUmum.get(m.nama).add(kelas);
        }
      });
    });

    return {
      rowsPondok: Array.from(resultPondok.entries()).map(
        ([mapel, kelasSet]) => ({
          mapel,
          kelas: Array.from(kelasSet),
        })
      ),
      rowsUmum: Array.from(resultUmum.entries()).map(
        ([mapel, kelasSet]) => ({
          mapel,
          kelas: Array.from(kelasSet),
        })
      ),
    };
  }

  // MODE PER KELAS (lama, BIARKAN)
  const siswaList = siswaKelas;

// === UMUM ===
const rowsUmum = mapelUmum
  .filter((m) => appliesToClass(m, selectedKelas))
  .map((m) => {
    let filled = 0;

    siswaList.forEach((s) => {
      const r = raporMap[s.nisn] || {};
      const nilai = readFlat(r, m.nama);

      // capaian (tetap dicek)
      const sk = safeKey(m.nama);
      const capCandidates = [
        `${m.nama}_capaian`,
        `capaian_${m.nama}`,
        `${sk}_CAPAIAN`,
        `CAPAIAN_${sk}`,
        `${sk}_capaian`,
        `capaian_${sk}`,
      ];

      let capaian;
      for (const cKey of capCandidates) {
        if (r[cKey] !== undefined) {
          capaian = r[cKey];
          break;
        }
      }

      if (nonEmpty(nilai) && nonEmpty(capaian)) filled++;
    });

    return {
      mapel: m.nama,
      kelas: [], // kosong → tidak dipakai di mode per kelas
      complete: filled === siswaList.length,
      filled,
      total: siswaList.length,
    };
  });

// === PONDOK ===
const rowsPondok = mapelPondok
  .filter((m) => appliesToClass(m, selectedKelas))
  .map((m) => {
    let filled = 0;

    siswaList.forEach((s) => {
      const r = raporMap[s.nisn] || {};
      const nested = readPondok(r, m.nama);
      const flat = readFlat(r, m.nama);
     if (
  nonEmpty(nested?.nilai) ||
  (typeof flat === "number" || nonEmpty(flat))
) {
  filled++;
}
    });

    return {
      mapel: m.nama,
      kelas: [],
      complete: filled === siswaList.length,
      filled,
      total: siswaList.length,
    };
  });

return { rowsUmum, rowsPondok };
}, [selectedKelas, kelasList, mapelUmum, mapelPondok, siswaKelas, raporMap]);


  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6 text-black">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 text-center mb-6">
          Preview Kelengkapan Nilai
        </h1>

        {/* Kelas Selector + Tombol Cetak (redirect ke halaman leger) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-8 flex items-center gap-3">
          <span className="text-sm text-slate-600">Pilih Kelas:</span>

<select
  value={selectedKelas}
  onChange={(e) => setSelectedKelas(e.target.value)}
  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
>
  <option value="__ALL__">Semua Kelas</option>

  {kelasList.length === 0 ? (
    <option value="">(kelas belum ada)</option>
  ) : (
    kelasList.map((k, i) => (
      <option key={`${k}-${i}`} value={k}>
        {k}
      </option>
    ))
  )}
</select>

{/* ===== Progress Bar ===== */}
<div className="hidden md:block w-full mt-4">
  <div className="flex justify-between text-xs text-slate-600 mb-1">
    <span>Progres Kelengkapan Nilai</span>
    <span>{progress.percent}%</span>
  </div>

  <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
      style={{ width: `${progress.percent}%` }}
    />
  </div>

  <div className="text-xs text-slate-500 mt-1">
    {progress.current} / {progress.total} nilai terisi
  </div>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600 mt-2 ">
    <div>
      <b>{progress.current}</b> nilai terisi
    </div>
    <div>
      <b>{progressDetail.siswaBelumLengkap}</b> siswa nilai belum lengkap
    </div>   
  </div>
</div>






          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm text-slate-500">
              {loading ? "⏳ Memuat..." : `Total siswa: ${siswaKelas.length}`}
            </div>
            <Link
              href={
                selectedKelas
                  ? `/leger/${encodeURIComponent(selectedKelas)}`
                  : "#"
              }
              className={`text-sm px-3 py-2 rounded-md text-white transition ${
                selectedKelas
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-slate-300 cursor-not-allowed"
              }`}
              aria-disabled={!selectedKelas}
            >
              Cetak
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* ===================== UMUM ===================== */}
          <Card title="📘 Preview Nilai Umum">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-indigo-50">
                  <tr className="text-slate-700">
                    <th className="w-14 px-3 py-2 border-b border-slate-200 text-center">
                      No
                    </th>
                    <th className="px-3 py-2 border-b border-slate-200 text-left">
                      Nama Mapel
                    </th>
                    <th className="w-56 px-3 py-2 border-b border-slate-200 text-left">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowsUmum.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        Kelas ini belum punya mapel umum pada koleksi{" "}
                        <b>mapel_umum</b>.
                      </td>
                    </tr>
                  ) : (
                    rowsUmum.map((r, i) => (
                      <tr
                        key={`${r.mapel}-u-${i}`}
                        className={
                          i % 2 ? "bg-white" : "bg-slate-50/50"
                        }
                      >
                        <td className="px-3 py-2 text-center">{i + 1}</td>
                        <td className="px-3 py-2">{r.mapel}</td>
                       <td className="px-3 py-2">
  {selectedKelas === "__ALL__" ? (
    // MODE SEMUA KELAS → badge kelas
    <div className="flex flex-wrap gap-1">
      {r.kelas.map((k) => (
        <span
          key={k}
          className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[11px] font-semibold"
        >
          {k}
        </span>
      ))}
    </div>
  ) : (
    // MODE PER KELAS → status lengkap
    <Pill ok={r.complete}>
      {r.complete
        ? `Lengkap (${r.filled}/${r.total})`
        : `Belum Lengkap (${r.filled}/${r.total})`}
    </Pill>
  )}
</td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ===================== PONDOK ===================== */}
          <Card title="📗 Preview Nilai Pondok">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50">
                  <tr className="text-slate-700">
                    <th className="w-14 px-3 py-2 border-b border-slate-200 text-center">
                      No
                    </th>
                    <th className="px-3 py-2 border-b border-slate-200 text-left">
                      Nama Mapel
                    </th>
                    <th className="w-56 px-3 py-2 border-b border-slate-200 text-left">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rowsPondok.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        Kelas ini belum punya mapel pondok pada koleksi{" "}
                        <b>mapel_pondok</b>.
                      </td>
                    </tr>
                  ) : (
                    rowsPondok.map((r, i) => (
                      <tr
                        key={`${r.mapel}-p-${i}`}
                        className={
                          i % 2 ? "bg-white" : "bg-slate-50/50"
                        }
                      >
                        <td className="px-3 py-2 text-center">{i + 1}</td>
                        <td className="px-3 py-2">{r.mapel}</td>
                       <td className="px-3 py-2">
  {selectedKelas === "__ALL__" ? (
    // MODE SEMUA KELAS → badge kelas
    <div className="flex flex-wrap gap-1">
      {r.kelas.map((k) => (
        <span
          key={k}
          className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[11px] font-semibold"
        >
          {k}
        </span>
      ))}
    </div>
  ) : (
    // MODE PER KELAS → status lengkap
    <Pill ok={r.complete}>
      {r.complete
        ? `Lengkap (${r.filled}/${r.total})`
        : `Belum Lengkap (${r.filled}/${r.total})`}
    </Pill>
  )}
</td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}