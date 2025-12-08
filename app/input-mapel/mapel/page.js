"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

/* ------------------------- dekor blob netral ------------------------- */
function Blob({ from = "#334155", to = "#111827" }) {
  const id = `g${from.replace("#", "")}${to.replace("#", "")}`;
  return (
    <svg viewBox="0 0 300 220" className="w-40 h-28 md:w-48 md:h-32 opacity-90">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        d="M204.6 32.2c25.7 17.3 45 36.4 43.7 63.3-1.2 26.8-23.1 61.4-50.4 74.7-27.3 13.2-60 5.2-86.6-10.3-26.6-15.6-47.3-39.5-44.7-62.2 2.6-22.6 30.4-43.9 58.4-58.1 28.1-14.1 57.9-24.7 79.6-7.4Z"
        fill={`url(#${id})`}
        className="drop-shadow-md"
      />
    </svg>
  );
}

export default function MapelKelasTwinPage() {
  /* ---------- global: daftar kelas & dataset sumber ---------- */
  const [kelasList, setKelasList] = useState([]);
  const [datasetUmum, setDatasetUmum] = useState([]);
  const [datasetPondok, setDatasetPondok] = useState([]);

  /* ---------- UMUM: state khusus ---------- */
  const [kelasUmum, setKelasUmum] = useState("");          // target
  const [copyFromUmum, setCopyFromUmum] = useState("");    // sumber copy
  const [pickUmum, setPickUmum] = useState("");            // id dataset
  const [listUmumKelas, setListUmumKelas] = useState([]);  // hasil terpasang
  const [loadingUmum, setLoadingUmum] = useState(false);

  /* ---------- PONDOK: state khusus ---------- */
  const [kelasPondok, setKelasPondok] = useState("");          // target
  const [copyFromPondok, setCopyFromPondok] = useState("");    // sumber copy
  const [pickPondok, setPickPondok] = useState("");            // id dataset
  const [listPondokKelas, setListPondokKelas] = useState([]);  // hasil terpasang
  const [loadingPondok, setLoadingPondok] = useState(false);

  /* ------------------------- helpers ------------------------- */
  const fmtPondok = (m) => (m.arab ? `${m.nama} (${m.arab})` : m.nama);

  const fetchKelas = async () => {
    try {
      const snap = await getDocs(collection(db, "siswa"));
      const arr = snap.docs.map((d) => d.data()?.kelas).filter(Boolean);
      const unique = [...new Set(arr)].sort();
      setKelasList(unique);
    } catch (e) {
      console.error("fetchKelas:", e);
    }
  };

  const fetchDataset = async () => {
    try {
      const qU = query(collection(db, "dataset_mapel_umum"), orderBy("createdAt", "desc"));
      const su = await getDocs(qU);
setDatasetUmum(su.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());

      const qP = query(collection(db, "dataset_mapel_pondok"), orderBy("createdAt", "desc")); 
      const sp = await getDocs(qP);
setDatasetPondok(sp.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
    } catch (e) {
      console.error("fetchDataset:", e);
    }
  };

  /* ---------- get list mapel yang terpasang per bagian ---------- */
  const fetchMapelUmum = async (kelas) => {
    if (!kelas) return;
    setLoadingUmum(true);
    try {
      const q = query(
  collection(db, "mapel_umum"),
  where("kelas", "==", kelas),
  orderBy("createdAt", "asc"),
  orderBy("nama", "asc") // tie-breaker jika timestamp sama
);
const s = await getDocs(q);
setListUmumKelas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("fetchMapelUmum:", e);
    } finally {
      setLoadingUmum(false);
    }
  };

  const fetchMapelPondok = async (kelas) => {
    if (!kelas) return;
    setLoadingPondok(true);
    try {
      const q = query(
  collection(db, "mapel_pondok"),
  where("kelas", "==", kelas),
  orderBy("createdAt", "asc"),
  orderBy("nama", "asc")
);
const s = await getDocs(q);
setListPondokKelas(s.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("fetchMapelPondok:", e);
    } finally {
      setLoadingPondok(false);
    }
  };

  useEffect(() => {
    fetchKelas();
    fetchDataset();
  }, []);

  useEffect(() => {
    if (kelasUmum) fetchMapelUmum(kelasUmum);
  }, [kelasUmum]);

  useEffect(() => {
    if (kelasPondok) fetchMapelPondok(kelasPondok);
  }, [kelasPondok]);

  /* ------------------------- tambah per bagian ------------------------- */
  const addUmum = async (e) => {
    e.preventDefault();
    if (!kelasUmum || !pickUmum) return;
    const src = datasetUmum.find((x) => x.id === pickUmum);
    if (!src) return;
    // anti duplikat
    const dupe = listUmumKelas.some(
      (m) => (m.nama || "").toLowerCase() === (src.nama || "").toLowerCase()
    );
    if (dupe) return alert("Mapel umum sudah ada di kelas ini.");
    await addDoc(collection(db, "mapel_umum"), {
      nama: src.nama,
      kelas: kelasUmum,
      createdAt: serverTimestamp(),
    });
    setPickUmum("");
    fetchMapelUmum(kelasUmum);
  };

  const addPondok = async (e) => {
    e.preventDefault();
    if (!kelasPondok || !pickPondok) return;
    const src = datasetPondok.find((x) => x.id === pickPondok);
    if (!src) return;
    const dupe = listPondokKelas.some(
      (m) => (m.nama || "").toLowerCase() === (src.nama || "").toLowerCase()
    );
    if (dupe) return alert("Mapel pondok sudah ada di kelas ini.");
    await addDoc(collection(db, "mapel_pondok"), {
      nama: src.nama,
      arab: src.arab || "",
      kelas: kelasPondok,
      createdAt: serverTimestamp(), 
    });
    setPickPondok("");
    fetchMapelPondok(kelasPondok);
  };

  /* ------------------------- hapus & copy ------------------------- */
  const removeItem = async (col, id, refreshFn) => {
    if (!confirm("Yakin hapus mapel ini dari kelas?")) return;
    await deleteDoc(doc(db, col, id));
    await refreshFn();
  };

  const copyUmum = async () => {
    if (!kelasUmum || !copyFromUmum) return;
    if (kelasUmum === copyFromUmum) return alert("Sumber dan tujuan tidak boleh sama.");
    setLoadingUmum(true);
    try {
      const qSrc = query(
  collection(db, "mapel_umum"),
  where("kelas", "==", copyFromUmum),
  orderBy("createdAt", "asc"),
  orderBy("nama", "asc")
);
      const s = await getDocs(qSrc);
      const source = s.docs.map((d) => d.data());

      // set yang sudah ada
      const existing = new Set(
        listUmumKelas.map((m) => (m.nama || "").toLowerCase())
      );

      for (const m of source) {
        const nm = (m.nama || "").toLowerCase();
        if (!existing.has(nm)) {
          await addDoc(collection(db, "mapel_umum"), {
            nama: m.nama,
            kelas: kelasUmum,
            createdAt: Date.now(),
          });
        }
      }
      await fetchMapelUmum(kelasUmum);
    } catch (e) {
      console.error("copyUmum:", e);
    } finally {
      setLoadingUmum(false);
    }
  };

  const copyPondok = async () => {
    if (!kelasPondok || !copyFromPondok) return;
    if (kelasPondok === copyFromPondok) return alert("Sumber dan tujuan tidak boleh sama.");
    setLoadingPondok(true);
    try {
      const qSrc = query(
  collection(db, "mapel_pondok"),
  where("kelas", "==", copyFromPondok),
  orderBy("createdAt", "asc"),
  orderBy("nama", "asc")
);
      const s = await getDocs(qSrc);
      const source = s.docs.map((d) => d.data());

      const existing = new Set(
        listPondokKelas.map((m) => (m.nama || "").toLowerCase())
      );

      for (const m of source) {
        const nm = (m.nama || "").toLowerCase();
        if (!existing.has(nm)) {
          await addDoc(collection(db, "mapel_pondok"), {
            nama: m.nama,
            arab: m.arab || "",
            kelas: kelasPondok,
            createdAt: Date.now(),
          });
        }
      }
      await fetchMapelPondok(kelasPondok);
    } catch (e) {
      console.error("copyPondok:", e);
    } finally {
      setLoadingPondok(false);
    }
  };

  /* ------------------------------- UI ------------------------------- */
  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6 text-black">
      <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* ===================== UMUM ===================== */}
        <div className="relative bg-white/95 border border-slate-200 rounded-3xl shadow-md overflow-hidden transition hover:shadow-2xl hover:scale-[1.005] hover:border-slate-300">
          <div className="bg-slate-900 text-white w-full px-6 py-3 text-sm md:text-base font-semibold tracking-wide rounded-t-3xl">
  Mapel Umum
</div>

          {/* header */}
          <div className="flex items-center gap-4 px-6 pt-5">
            <Blob from="#6366F1" to="#4338CA" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Kategori</div>
              <div className="text-xl md:text-2xl font-black text-slate-800">📘 Umum</div>
              <div className="mt-1 text-slate-600">
                Dataset: <b>{datasetUmum.length}</b> mapel
              </div>
            </div>
          </div>

          {/* pilih kelas target & copy-from khusus UMUM */}
          <div className="px-6 mt-4 grid md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Kelas Tujuan:</span>
              <select
                value={kelasUmum}
                onChange={(e) => setKelasUmum(e.target.value)}
                className="flex-1 min-w-[120px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">— Pilih —</option>
                {kelasList.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Copy dari:</span>
              <select
                value={copyFromUmum}
                onChange={(e) => setCopyFromUmum(e.target.value)}
                className="flex-1 min-w-[120px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                disabled={!kelasUmum}
              >
                <option value="">— Pilih —</option>
                {kelasList.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <button
                onClick={copyUmum}
                disabled={!kelasUmum || !copyFromUmum}
                className="rounded-md px-3 py-2 text-sm font-medium bg-slate-700 text-white disabled:opacity-40 hover:bg-slate-800 transition whitespace-nowrap"
              >
                ⎘ Copy
              </button>
            </div>
          </div>

          {/* baris form tambah (dropdown + tombol) */}
          <div className="px-6 mt-4">
            <form onSubmit={addUmum} className="flex flex-wrap md:flex-nowrap items-center gap-3">
              <select
                value={pickUmum}
                onChange={(e) => setPickUmum(e.target.value)}
                className="flex-1 min-w-[240px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                disabled={!kelasUmum}
              >
                <option value="">{kelasUmum ? "— Pilih dari dataset —" : "Pilih kelas dulu"}</option>
                {datasetUmum.map((m) => (
                  <option key={m.id} value={m.id}>{m.nama}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!kelasUmum || !pickUmum}
                className="rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition"
              >
                + Tambah ke Kelas
              </button>
            </form>
          </div>

          {/* tabel terpasang */}
          <div className="px-6 pb-6 mt-4">
            {loadingUmum && <div className="text-slate-500 text-sm">Memuat…</div>}
            {!loadingUmum && kelasUmum && (
              <table className="w-full border border-slate-200 text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2 w-12 text-center">No</th>
                    <th className="border p-2 text-left">Nama Mapel</th>
                    <th className="border p-2 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {listUmumKelas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center p-3 text-slate-500">
                        Belum ada mapel umum untuk kelas ini.
                      </td>
                    </tr>
                  ) : (
                    listUmumKelas.map((m, i) => (
                      <tr key={m.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border p-2 text-center">{i + 1}</td>
                        <td className="border p-2">{m.nama}</td>
                        <td className="border p-2 text-center">
                          <button
                            onClick={() => removeItem("mapel_umum", m.id, () => fetchMapelUmum(kelasUmum))}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 transition"
                          >
                            🗑 Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ===================== PONDOK ===================== */}
        <div className="relative bg-white/95 border border-slate-200 rounded-3xl shadow-md overflow-hidden transition hover:shadow-2xl hover:scale-[1.005] hover:border-slate-300">
          <div className="bg-slate-900 text-white w-full px-6 py-3 text-sm md:text-base font-semibold tracking-wide rounded-t-3xl">
            Mapel Pondok
          </div>

          <div className="flex items-center gap-4 px-6 pt-5">
            <Blob from="#10B981" to="#065F46" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Kategori</div>
              <div className="text-xl md:text-2xl font-black text-slate-800">📗 Pondok</div>
              <div className="mt-1 text-slate-600">
                Dataset: <b>{datasetPondok.length}</b> mapel
              </div>
            </div>
          </div>

          {/* pilih kelas target & copy-from khusus PONDOK */}
          <div className="px-6 mt-4 grid md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Kelas Tujuan:</span>
              <select
                value={kelasPondok}
                onChange={(e) => setKelasPondok(e.target.value)}
                className="flex-1 min-w-[120px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">— Pilih —</option>
                {kelasList.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Copy dari:</span>
              <select
                value={copyFromPondok}
                onChange={(e) => setCopyFromPondok(e.target.value)}
                className="flex-1 min-w-[120px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                disabled={!kelasPondok}
              >
                <option value="">— Pilih Kelas —</option>
                {kelasList.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <button
                onClick={copyPondok}
                disabled={!kelasPondok || !copyFromPondok}
                className="rounded-md px-3 py-2 text-sm font-medium bg-slate-700 text-white disabled:opacity-40 hover:bg-slate-800 transition whitespace-nowrap"
              >
                ⎘ Copy
              </button>
            </div>
          </div>

          {/* baris form tambah */}
          <div className="px-6 mt-4">
            <form onSubmit={addPondok} className="flex flex-wrap md:flex-nowrap items-center gap-3">
              <select
                value={pickPondok}
                onChange={(e) => setPickPondok(e.target.value)}
                className="flex-1 min-w-[240px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                disabled={!kelasPondok}
              >
                <option value="">{kelasPondok ? "— Pilih dari dataset —" : "Pilih kelas dulu"}</option>
                {datasetPondok.map((m) => (
                  <option key={m.id} value={m.id}>{fmtPondok(m)}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!kelasPondok || !pickPondok}
                className="rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700 transition"
              >
                + Tambah ke Kelas
              </button>
            </form>
          </div>

          {/* tabel terpasang */}
          <div className="px-6 pb-6 mt-4">
            {loadingPondok && <div className="text-slate-500 text-sm">Memuat…</div>}
            {!loadingPondok && kelasPondok && (
              <table className="w-full border border-slate-200 text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2 w-12 text-center">No</th>
                    <th className="border p-2 text-left">Nama Mapel</th>
                    <th className="border p-2 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {listPondokKelas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center p-3 text-slate-500">
                        Belum ada mapel pondok untuk kelas ini.
                      </td>
                    </tr>
                  ) : (
                    listPondokKelas.map((m, i) => (
                      <tr key={m.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border p-2 text-center">{i + 1}</td>
                        <td className="border p-2">{fmtPondok(m)}</td>
                        <td className="border p-2 text-center">
                          <button
                            onClick={() => removeItem("mapel_pondok", m.id, () => fetchMapelPondok(kelasPondok))}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 transition"
                          >
                            🗑 Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
