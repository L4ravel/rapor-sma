"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import * as XLSX from "xlsx";

/* ---------- Blob dekor ---------- */
function Blob({ variant = "indigo" }) {
  const id = variant === "indigo" ? "gIndigo" : "gEmerald";
  return (
    <svg viewBox="0 0 300 220" className="w-40 h-28 md:w-48 md:h-32 opacity-90">
      <defs>
        <linearGradient id="gIndigo" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>
        <linearGradient id="gEmerald" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#065f46" />
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

export default function DatasetMapelCards() {
  const [mapelUmum, setMapelUmum] = useState([]);
  const [mapelPondok, setMapelPondok] = useState([]);
  const [editItem, setEditItem] = useState(null);

  // input manual
  const [newUmum, setNewUmum] = useState("");
  const [newPondok, setNewPondok] = useState({ nama: "", arab: "" });

  /* ---------- Fetch (terbaru di bawah) ---------- */
  const fetchData = async () => {
    const qUmum = query(
      collection(db, "dataset_mapel_umum"),
      orderBy("createdAt", "asc")
    );
    const us = await getDocs(qUmum);
    setMapelUmum(us.docs.map((d) => ({ id: d.id, ...d.data() })));

    const qPondok = query(
      collection(db, "dataset_mapel_pondok"),
      orderBy("createdAt", "asc")
    );
    const ps = await getDocs(qPondok);
    setMapelPondok(ps.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ---------- Template & Upload ---------- */
  const downloadTemplate = (type) => {
    const ws =
      type === "umum"
        ? XLSX.utils.aoa_to_sheet([["No", "Nama Mapel"]])
        : XLSX.utils.aoa_to_sheet([["No", "Nama Mapel", "Tulisan Arab"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `template_mapel_${type}.xlsx`);
  };

  const uploadExcel = async (e, type) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    for (const r of rows) {
      if (type === "umum") {
        const nama = (r["Nama Mapel"] || "").toString().trim();
        if (!nama) continue;
        await addDoc(collection(db, "dataset_mapel_umum"), {
          nama,
          createdAt: serverTimestamp(),
        });
      } else {
        const nama = (r["Nama Mapel"] || "").toString().trim();
        const arab = (r["Tulisan Arab"] || "").toString().trim();
        if (!nama) continue;
        await addDoc(collection(db, "dataset_mapel_pondok"), {
          nama,
          arab,
          createdAt: serverTimestamp(),
        });
      }
    }
    e.target.value = "";
    fetchData();
  };

  /* ---------- CRUD ---------- */
  const handleDelete = async (col, id) => {
    await deleteDoc(doc(db, col, id));
    fetchData();
  };
  const handleEdit = (col, item) => setEditItem({ col, ...item });
  const saveEdit = async () => {
    if (!editItem) return;
    const { col, id, nama, arab } = editItem;
    await updateDoc(
      doc(db, col, id),
      arab !== undefined
        ? { nama: nama?.trim() || "", arab: arab?.trim() || "" }
        : { nama: nama?.trim() || "" }
    );
    setEditItem(null);
    fetchData();
  };

  /* ---------- Add Manual ---------- */
  const addManualUmum = async () => {
    const nama = newUmum.trim();
    if (!nama) return;
    await addDoc(collection(db, "dataset_mapel_umum"), {
      nama,
      createdAt: serverTimestamp(),
    });
    setNewUmum("");
    fetchData();
  };
  const addManualPondok = async () => {
    const nama = newPondok.nama.trim();
    const arab = newPondok.arab.trim();
    if (!nama) return;
    await addDoc(collection(db, "dataset_mapel_pondok"), {
      nama,
      arab,
      createdAt: serverTimestamp(),
    });
    setNewPondok({ nama: "", arab: "" });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6 text-black">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 text-center mb-10">
        Dataset Mapel
      </h1>

      <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* ===================== CARD UMUM ===================== */}
        <div className="relative bg-white/95 border border-slate-200 rounded-3xl shadow-md overflow-hidden transition hover:shadow-2xl hover:scale-[1.01] hover:border-slate-300">
          {/* === CHANGED: strip judul kecil dihapus & diganti strip full width === */}
          <div className="bg-slate-900 text-white w-full px-6 py-3 text-sm md:text-base font-semibold tracking-wide rounded-t-3xl shadow-sm">
            Mapel Umum
          </div>
          {/* === CHANGED: padding atas konten disesuaikan (tidak absolute lagi) === */}

          {/* header konten */}
          <div className="flex items-center gap-4 px-6 pt-5">
            <Blob variant="indigo" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Kategori
              </div>
              <div className="text-xl md:text-2xl font-black text-slate-800">
                📘 Mapel Umum
              </div>
              <div className="mt-1 text-slate-600">
                Total: <b>{mapelUmum.length}</b> mapel
              </div>
            </div>
          </div>

          {/* BARIS-1: template & upload (atas) */}
          <div className="px-6 mt-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => downloadTemplate("umum")}
                className="rounded-md px-3 py-2 text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 active:scale-[0.98] transition"
                type="button"
              >
                ⬇️ Template
              </button>

              <label className="rounded-md px-3 py-2 text-sm font-medium border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer">
                📤 Upload Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => uploadExcel(e, "umum")}
                  className="hidden"
                />
              </label>
            </div>

            {/* BARIS-2: input manual + tambah (sejajar) */}
            <div className="mt-3 flex flex-wrap md:flex-nowrap items-center gap-3">
              <input
                value={newUmum}
                onChange={(e) => setNewUmum(e.target.value)}
                placeholder="Nama mapel (tambah manual)"
                className="flex-1 min-w-[220px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                onClick={addManualUmum}
                className="rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
                type="button"
              >
                + Tambah
              </button>
            </div>
          </div>

          {/* list */}
          <ul className="px-2 pb-6 mt-4 max-h-[420px] overflow-auto">
            {mapelUmum.length === 0 && (
              <li className="mx-4 my-6 text-slate-500 text-center">
                Belum ada data.
              </li>
            )}
            {mapelUmum.map((m, i) => (
              <li
                key={m.id}
                className="mx-4 my-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-indigo-600">✔</span>
                  <span className="text-sm font-medium text-slate-800">
                    {i + 1}. {m.nama}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleEdit("dataset_mapel_umum", { id: m.id, nama: m.nama })
                    }
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete("dataset_mapel_umum", m.id)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 transition"
                  >
                    🗑 Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ===================== CARD PONDOK ===================== */}
        <div className="relative bg-white/95 border border-slate-200 rounded-3xl shadow-md overflow-hidden transition hover:shadow-2xl hover:scale-[1.01] hover:border-slate-300">
          {/* === CHANGED: strip judul full width === */}
          <div className="bg-slate-900 text-white w-full px-6 py-3 text-sm md:text-base font-semibold tracking-wide rounded-t-3xl shadow-sm">
            Mapel Pondok
          </div>

          <div className="flex items-center gap-4 px-6 pt-5">
            <Blob variant="emerald" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Kategori
              </div>
              <div className="text-xl md:text-2xl font-black text-slate-800">
                📗 Mapel Pondok
              </div>
              <div className="mt-1 text-slate-600">
                Total: <b>{mapelPondok.length}</b> mapel
              </div>
            </div>
          </div>

          {/* BARIS-1: template & upload */}
          <div className="px-6 mt-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => downloadTemplate("pondok")}
                className="rounded-md px-3 py-2 text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 transition"
                type="button"
              >
                ⬇️ Template
              </button>

              <label className="rounded-md px-3 py-2 text-sm font-medium border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer">
                📤 Upload Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => uploadExcel(e, "pondok")}
                  className="hidden"
                />
              </label>
            </div>

            {/* BARIS-2: dua input + tambah */}
            <div className="mt-3 flex flex-wrap md:flex-nowrap items-center gap-3">
              <input
                value={newPondok.nama}
                onChange={(e) =>
                  setNewPondok((p) => ({ ...p, nama: e.target.value }))
                }
                placeholder="Nama mapel (tambah manual)"
                className="flex-1 min-w-[200px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <input
                value={newPondok.arab}
                onChange={(e) =>
                  setNewPondok((p) => ({ ...p, arab: e.target.value }))
                }
                placeholder="Tulisan Arab (wajib diisi)"
                className="flex-1 min-w-[180px] border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                onClick={addManualPondok}
                className="rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                type="button"
              >
                + Tambah
              </button>
            </div>
          </div>

          {/* list */}
          <ul className="px-2 pb-6 mt-4 max-h-[420px] overflow-auto">
            {mapelPondok.length === 0 && (
              <li className="mx-4 my-6 text-slate-500 text-center">
                Belum ada data.
              </li>
            )}
            {mapelPondok.map((m, i) => (
              <li
                key={m.id}
                className="mx-4 my-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-600">✔</span>
                      <span className="text-sm font-medium text-slate-800">
                        {i + 1}. {m.nama}
                      </span>
                    </div>
                    {m.arab && (
                      <span className="ml-6 mt-1 text-xs text-slate-500">
                        {m.arab}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleEdit("dataset_mapel_pondok", {
                          id: m.id,
                          nama: m.nama,
                          arab: m.arab || "",
                        })
                      }
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete("dataset_mapel_pondok", m.id)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 transition"
                    >
                      🗑 Hapus
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---------- Modal Edit ---------- */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-[92%] max-w-md">
            <h3 className="text-base font-semibold mb-4 text-slate-800">
              ✏️ Edit Mapel
            </h3>

            <label className="block text-sm text-slate-700 mb-1">
              Nama Mapel
            </label>
            <input
              type="text"
              value={editItem.nama || ""}
              onChange={(e) =>
                setEditItem((prev) => ({ ...prev, nama: e.target.value }))
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Nama mapel"
            />

            {editItem.arab !== undefined && (
              <>
                <label className="block text-sm text-slate-700 mb-1">
                  Tulisan Arab
                </label>
                <input
                  type="text"
                  value={editItem.arab || ""}
                  onChange={(e) =>
                    setEditItem((prev) => ({ ...prev, arab: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Tulisan Arab (opsional)"
                />
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditItem(null)}
                className="px-3 py-2 rounded-md text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
                type="button"
              >
                Batal
              </button>
              <button
                onClick={saveEdit}
                className="px-3 py-2 rounded-md text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 transition"
                type="button"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
