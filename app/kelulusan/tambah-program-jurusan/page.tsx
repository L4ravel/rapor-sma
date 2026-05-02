/* Halaman master program jurusan + mapel kelulusan, lengkap dengan kelompok mapel A/B/C, edit, hapus, dan sinkron relasi ke siswa. */

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

type KelompokMapel = "A" | "B" | "C";

type JurusanItem = {
  id: string;
  nama: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type MapelItem = {
  id: string;
  nama: string;
  kelompok?: KelompokMapel;
  jurusanId: string;
  jurusanNama: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type SiswaItem = {
  id: string;
  programJurusanId?: string;
  programJurusanNama?: string;
  mapelSnapshot?: Array<{ mapelId: string; nama: string; kelompok?: KelompokMapel }>;
  nilaiByMapelId?: Record<string, string>;
};

const MAX_BATCH = 400;
const KELOMPOK_MAPEL: KelompokMapel[] = ["A", "B", "C"];

function Blob({ from = "#334155", to = "#111827" }) {
  const id = `g${from.replace("#", "")}${to.replace("#", "")}`;
  return (
    <svg viewBox="0 0 300 220" className="h-28 w-40 opacity-90 md:h-32 md:w-48">
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

function normalizeKelompok(value?: string): KelompokMapel {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "A" || clean === "B" || clean === "C") return clean;
  return "A";
}

function getKelompokRank(value?: string) {
  const kelompok = normalizeKelompok(value);
  return KELOMPOK_MAPEL.indexOf(kelompok);
}

function sortMapel(a: MapelItem, b: MapelItem) {
  const kelompokCompare = getKelompokRank(a.kelompok) - getKelompokRank(b.kelompok);
  if (kelompokCompare !== 0) return kelompokCompare;
  return (a.nama || "").localeCompare(b.nama || "", "id");
}

async function commitInChunks(
  items: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }>
) {
  for (let i = 0; i < items.length; i += MAX_BATCH) {
    const chunk = items.slice(i, i + MAX_BATCH);
    const batch = writeBatch(db);
    chunk.forEach((item) => batch.update(item.ref, item.data));
    await batch.commit();
  }
}

export default function TambahProgramJurusanPage() {
  const [loading, setLoading] = useState(true);

  const [jurusanList, setJurusanList] = useState<JurusanItem[]>([]);
  const [selectedJurusanId, setSelectedJurusanId] = useState("");
  const [mapelList, setMapelList] = useState<MapelItem[]>([]);

  const [newJurusan, setNewJurusan] = useState("");
  const [editingJurusanId, setEditingJurusanId] = useState("");
  const [editingJurusanNama, setEditingJurusanNama] = useState("");
  const [savingJurusan, setSavingJurusan] = useState(false);

  const [newMapel, setNewMapel] = useState("");
  const [newMapelKelompok, setNewMapelKelompok] = useState<KelompokMapel>("A");
  const [editingMapelId, setEditingMapelId] = useState("");
  const [editingMapelNama, setEditingMapelNama] = useState("");
  const [editingMapelKelompok, setEditingMapelKelompok] = useState<KelompokMapel>("A");
  const [savingMapel, setSavingMapel] = useState(false);

  const jurusanCol = collection(db, "kelulusan_program_jurusan");
  const mapelCol = collection(db, "kelulusan_mapel");
  const siswaCol = collection(db, "kelulusan_siswa");

  const selectedJurusan = useMemo(
    () => jurusanList.find((item) => item.id === selectedJurusanId) || null,
    [jurusanList, selectedJurusanId]
  );

  const mapelByKelompok = useMemo(() => {
    return KELOMPOK_MAPEL.map((kelompok) => ({
      kelompok,
      items: mapelList.filter((item) => normalizeKelompok(item.kelompok) === kelompok),
    }));
  }, [mapelList]);

  async function loadJurusan() {
    const snap = await getDocs(jurusanCol);
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<JurusanItem, "id">) }))
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));
    setJurusanList(rows);
    return rows;
  }

  async function loadMapel(jurusanId: string) {
    if (!jurusanId) {
      setMapelList([]);
      return [];
    }

    const snap = await getDocs(query(mapelCol, where("jurusanId", "==", jurusanId)));
    const rows = snap.docs
      .map((d) => {
        const data = d.data() as Omit<MapelItem, "id">;
        return {
          id: d.id,
          ...data,
          kelompok: normalizeKelompok(data.kelompok),
        };
      })
      .sort(sortMapel);

    setMapelList(rows);
    return rows;
  }

  async function loadAll() {
    try {
      setLoading(true);
      const jurusan = await loadJurusan();

      if (jurusan.length > 0) {
        const targetId =
          selectedJurusanId && jurusan.some((j) => j.id === selectedJurusanId)
            ? selectedJurusanId
            : jurusan[0].id;

        setSelectedJurusanId(targetId);
        await loadMapel(targetId);
      } else {
        setSelectedJurusanId("");
        setMapelList([]);
      }
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal memuat data program jurusan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedJurusanId) {
      loadMapel(selectedJurusanId);
    } else {
      setMapelList([]);
    }
  }, [selectedJurusanId]);

  async function syncJurusanNameToRelations(jurusanId: string, jurusanNamaBaru: string) {
    const siswaSnap = await getDocs(
      query(siswaCol, where("programJurusanId", "==", jurusanId))
    );

    const mapelSnap = await getDocs(query(mapelCol, where("jurusanId", "==", jurusanId)));

    const batchItems: Array<{
      ref: ReturnType<typeof doc>;
      data: Record<string, unknown>;
    }> = [];

    siswaSnap.docs.forEach((d) => {
      batchItems.push({
        ref: doc(db, "kelulusan_siswa", d.id),
        data: {
          programJurusanNama: jurusanNamaBaru,
          updatedAt: serverTimestamp(),
        },
      });
    });

    mapelSnap.docs.forEach((d) => {
      batchItems.push({
        ref: doc(db, "kelulusan_mapel", d.id),
        data: {
          jurusanNama: jurusanNamaBaru,
          updatedAt: serverTimestamp(),
        },
      });
    });

    if (batchItems.length > 0) {
      await commitInChunks(batchItems);
    }
  }

  async function syncMapelSnapshotToSiswa(jurusanId: string) {
    const [mapelSnap, siswaSnap] = await Promise.all([
      getDocs(query(mapelCol, where("jurusanId", "==", jurusanId))),
      getDocs(query(siswaCol, where("programJurusanId", "==", jurusanId))),
    ]);

    const mapelRows = mapelSnap.docs
      .map((d) => {
        const data = d.data() as Omit<MapelItem, "id">;
        return {
          id: d.id,
          ...data,
          kelompok: normalizeKelompok(data.kelompok),
        };
      })
      .sort(sortMapel);

    const freshSnapshot = mapelRows.map((m) => ({
      mapelId: m.id,
      nama: m.nama || "",
      kelompok: normalizeKelompok(m.kelompok),
    }));

    const batchItems: Array<{
      ref: ReturnType<typeof doc>;
      data: Record<string, unknown>;
    }> = [];

    siswaSnap.docs.forEach((d) => {
      const siswa = d.data() as SiswaItem;
      const oldNilai = siswa.nilaiByMapelId || {};
      const nextNilai: Record<string, string> = {};

      freshSnapshot.forEach((m) => {
        nextNilai[m.mapelId] = oldNilai[m.mapelId] || "";
      });

      batchItems.push({
        ref: doc(db, "kelulusan_siswa", d.id),
        data: {
          mapelSnapshot: freshSnapshot,
          nilaiByMapelId: nextNilai,
          updatedAt: serverTimestamp(),
        },
      });
    });

    if (batchItems.length > 0) {
      await commitInChunks(batchItems);
    }
  }

  async function addJurusan(e: React.FormEvent) {
    e.preventDefault();
    const nama = newJurusan.trim();
    if (!nama) return alert("❌ Nama program jurusan wajib diisi");

    const dupe = jurusanList.some(
      (item) => item.nama.trim().toLowerCase() === nama.toLowerCase()
    );
    if (dupe) return alert("❌ Program jurusan sudah ada");

    try {
      setSavingJurusan(true);
      const created = await addDoc(jurusanCol, {
        nama,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewJurusan("");
      await loadJurusan();
      setSelectedJurusanId(created.id);
      await loadMapel(created.id);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menambah program jurusan");
    } finally {
      setSavingJurusan(false);
    }
  }

  async function saveEditJurusan(jurusanId: string) {
    const namaBaru = editingJurusanNama.trim();
    if (!namaBaru) return alert("❌ Nama program jurusan wajib diisi");

    const dupe = jurusanList.some(
      (item) =>
        item.id !== jurusanId &&
        item.nama.trim().toLowerCase() === namaBaru.toLowerCase()
    );
    if (dupe) return alert("❌ Nama program jurusan sudah dipakai");

    try {
      setSavingJurusan(true);
      await updateDoc(doc(db, "kelulusan_program_jurusan", jurusanId), {
        nama: namaBaru,
        updatedAt: serverTimestamp(),
      });

      await syncJurusanNameToRelations(jurusanId, namaBaru);
      await loadJurusan();
      if (selectedJurusanId === jurusanId) {
        await loadMapel(jurusanId);
      }

      setEditingJurusanId("");
      setEditingJurusanNama("");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal mengubah nama jurusan");
    } finally {
      setSavingJurusan(false);
    }
  }

  async function deleteJurusan(jurusan: JurusanItem) {
    const [mapelSnap, siswaSnap] = await Promise.all([
      getDocs(query(mapelCol, where("jurusanId", "==", jurusan.id))),
      getDocs(query(siswaCol, where("programJurusanId", "==", jurusan.id))),
    ]);

    if (!siswaSnap.empty) {
      return alert(
        "❌ Jurusan ini sudah dipakai siswa. Hapus atau pindahkan siswa dulu agar relasi tetap aman."
      );
    }

    const ok = confirm(`Hapus program jurusan "${jurusan.nama}" beserta semua mapelnya?`);
    if (!ok) return;

    try {
      setSavingJurusan(true);

      const batch = writeBatch(db);
      batch.delete(doc(db, "kelulusan_program_jurusan", jurusan.id));
      mapelSnap.docs.forEach((d) => {
        batch.delete(doc(db, "kelulusan_mapel", d.id));
      });
      await batch.commit();

      await loadAll();
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus program jurusan");
    } finally {
      setSavingJurusan(false);
    }
  }

  async function addMapel(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJurusan) return alert("❌ Pilih program jurusan dulu");

    const nama = newMapel.trim();
    const kelompok = normalizeKelompok(newMapelKelompok);

    if (!nama) return alert("❌ Nama mapel wajib diisi");

    const dupe = mapelList.some(
      (item) =>
        normalizeKelompok(item.kelompok) === kelompok &&
        item.nama.trim().toLowerCase() === nama.toLowerCase()
    );
    if (dupe) return alert(`❌ Mapel sudah ada di Kelompok ${kelompok}`);

    try {
      setSavingMapel(true);
      await addDoc(mapelCol, {
        nama,
        kelompok,
        jurusanId: selectedJurusan.id,
        jurusanNama: selectedJurusan.nama,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewMapel("");
      setNewMapelKelompok("A");
      await loadMapel(selectedJurusan.id);
      await syncMapelSnapshotToSiswa(selectedJurusan.id);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menambah mapel");
    } finally {
      setSavingMapel(false);
    }
  }

  async function saveEditMapel(mapel: MapelItem) {
    const namaBaru = editingMapelNama.trim();
    const kelompokBaru = normalizeKelompok(editingMapelKelompok);

    if (!namaBaru) return alert("❌ Nama mapel wajib diisi");

    const dupe = mapelList.some(
      (item) =>
        item.id !== mapel.id &&
        normalizeKelompok(item.kelompok) === kelompokBaru &&
        item.nama.trim().toLowerCase() === namaBaru.toLowerCase()
    );
    if (dupe) return alert(`❌ Nama mapel sudah dipakai pada Kelompok ${kelompokBaru}`);

    try {
      setSavingMapel(true);
      await updateDoc(doc(db, "kelulusan_mapel", mapel.id), {
        nama: namaBaru,
        kelompok: kelompokBaru,
        updatedAt: serverTimestamp(),
      });

      await loadMapel(mapel.jurusanId);
      await syncMapelSnapshotToSiswa(mapel.jurusanId);

      setEditingMapelId("");
      setEditingMapelNama("");
      setEditingMapelKelompok("A");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal mengubah mapel");
    } finally {
      setSavingMapel(false);
    }
  }

  async function deleteMapel(mapel: MapelItem) {
    const ok = confirm(
      `Hapus mapel "${mapel.nama}" dari Kelompok ${normalizeKelompok(mapel.kelompok)}?`
    );
    if (!ok) return;

    try {
      setSavingMapel(true);
      await deleteDoc(doc(db, "kelulusan_mapel", mapel.id));
      await loadMapel(mapel.jurusanId);
      await syncMapelSnapshotToSiswa(mapel.jurusanId);
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menghapus mapel");
    } finally {
      setSavingMapel(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 text-black">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-md transition hover:border-slate-300 hover:shadow-2xl">
          <div className="w-full rounded-t-3xl bg-slate-900 px-6 py-3 text-sm font-semibold tracking-wide text-white md:text-base">
            Program Jurusan
          </div>

          <div className="flex items-center gap-4 px-6 pt-5">
            <Blob from="#6366F1" to="#4338CA" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Kelulusan
              </div>
              <div className="text-xl font-black text-slate-800 md:text-2xl">
                🎓 Master Jurusan
              </div>
              <div className="mt-1 text-slate-600">
                Total: <b>{jurusanList.length}</b> jurusan
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4">
            <form onSubmit={addJurusan} className="flex flex-wrap items-center gap-3">
              <input
                value={newJurusan}
                onChange={(e) => setNewJurusan(e.target.value)}
                placeholder="Contoh: IPA / IPS / Keagamaan"
                className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                type="submit"
                disabled={savingJurusan}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                + Tambah Jurusan
              </button>
            </form>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="w-12 border p-2 text-center">No</th>
                    <th className="border p-2 text-left">Nama Jurusan</th>
                    <th className="w-40 border p-2 text-center">Pilih</th>
                    <th className="w-44 border p-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        Memuat...
                      </td>
                    </tr>
                  ) : jurusanList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        Belum ada program jurusan.
                      </td>
                    </tr>
                  ) : (
                    jurusanList.map((item, i) => (
                      <tr key={item.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border p-2 text-center">{i + 1}</td>
                        <td className="border p-2">
                          {editingJurusanId === item.id ? (
                            <input
                              value={editingJurusanNama}
                              onChange={(e) => setEditingJurusanNama(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                          ) : (
                            <span className="font-medium">{item.nama}</span>
                          )}
                        </td>
                        <td className="border p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedJurusanId(item.id)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                              selectedJurusanId === item.id
                                ? "bg-slate-900 text-white"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {selectedJurusanId === item.id ? "Aktif" : "Pilih"}
                          </button>
                        </td>
                        <td className="border p-2 text-center">
                          <div className="flex flex-wrap justify-center gap-2">
                            {editingJurusanId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => saveEditJurusan(item.id)}
                                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                                >
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingJurusanId("");
                                    setEditingJurusanNama("");
                                  }}
                                  className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingJurusanId(item.id);
                                    setEditingJurusanNama(item.nama);
                                  }}
                                  className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteJurusan(item)}
                                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-md transition hover:border-slate-300 hover:shadow-2xl">
          <div className="w-full rounded-t-3xl bg-slate-900 px-6 py-3 text-sm font-semibold tracking-wide text-white md:text-base">
            Mapel per Jurusan
          </div>

          <div className="flex items-center gap-4 px-6 pt-5">
            <Blob from="#10B981" to="#065F46" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Jurusan Aktif
              </div>
              <div className="text-xl font-black text-slate-800 md:text-2xl">
                📚 {selectedJurusan?.nama || "Belum dipilih"}
              </div>
              <div className="mt-1 text-slate-600">
                Total mapel: <b>{mapelList.length}</b>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4">
            <form onSubmit={addMapel} className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr_auto]">
              <select
                value={newMapelKelompok}
                onChange={(e) => setNewMapelKelompok(normalizeKelompok(e.target.value))}
                disabled={!selectedJurusan}
                className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
              >
                {KELOMPOK_MAPEL.map((kelompok) => (
                  <option key={kelompok} value={kelompok}>
                    Kelompok {kelompok}
                  </option>
                ))}
              </select>

              <input
                value={newMapel}
                onChange={(e) => setNewMapel(e.target.value)}
                placeholder={selectedJurusan ? "Tulis nama mapel..." : "Pilih jurusan dulu"}
                disabled={!selectedJurusan}
                className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
              />

              <button
                type="submit"
                disabled={!selectedJurusan || savingMapel}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                + Tambah Mapel
              </button>
            </form>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="w-12 border p-2 text-center">No</th>
                    <th className="w-32 border p-2 text-left">Kelompok</th>
                    <th className="border p-2 text-left">Nama Mapel</th>
                    <th className="w-44 border p-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedJurusan ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        Pilih jurusan dulu.
                      </td>
                    </tr>
                  ) : mapelList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        Belum ada mapel di jurusan ini.
                      </td>
                    </tr>
                  ) : (
                    mapelByKelompok.map((group) => (
  <Fragment key={`kelompok-${group.kelompok}`}>
    <tr className="bg-slate-900 text-white">
      <td colSpan={4} className="border border-slate-700 px-3 py-2 text-sm font-bold">
        Kelompok {group.kelompok}{" "}
        <span className="font-normal text-slate-300">
          ({group.items.length} mapel)
        </span>
      </td>
    </tr>

    {group.items.length === 0 ? (
      <tr className="bg-white">
        <td colSpan={4} className="border p-3 text-center text-slate-400">
          Belum ada mapel Kelompok {group.kelompok}.
        </td>
      </tr>
    ) : (
      group.items.map((item, i) => (
                            <tr key={item.id} className="odd:bg-white even:bg-slate-50">
                              <td className="border p-2 text-center">{i + 1}</td>
                              <td className="border p-2">
                                {editingMapelId === item.id ? (
                                  <select
                                    value={editingMapelKelompok}
                                    onChange={(e) =>
                                      setEditingMapelKelompok(normalizeKelompok(e.target.value))
                                    }
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                  >
                                    {KELOMPOK_MAPEL.map((kelompok) => (
                                      <option key={kelompok} value={kelompok}>
                                        Kelompok {kelompok}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                                    Kelompok {normalizeKelompok(item.kelompok)}
                                  </span>
                                )}
                              </td>
                              <td className="border p-2">
                                {editingMapelId === item.id ? (
                                  <input
                                    value={editingMapelNama}
                                    onChange={(e) => setEditingMapelNama(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                  />
                                ) : (
                                  <span className="font-medium">{item.nama}</span>
                                )}
                              </td>
                              <td className="border p-2 text-center">
                                <div className="flex flex-wrap justify-center gap-2">
                                  {editingMapelId === item.id ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => saveEditMapel(item)}
                                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                                      >
                                        Simpan
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMapelId("");
                                          setEditingMapelNama("");
                                          setEditingMapelKelompok("A");
                                        }}
                                        className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMapelId(item.id);
                                          setEditingMapelNama(item.nama);
                                          setEditingMapelKelompok(normalizeKelompok(item.kelompok));
                                        }}
                                        className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteMapel(item)}
                                        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                                      >
                                        Hapus
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {selectedJurusan && (
              <p className="mt-3 text-xs text-slate-500">
                Saat mapel ditambah, diubah, dipindahkan kelompok, atau dihapus, snapshot
                mapel pada siswa yang memilih jurusan ini akan ikut disinkronkan.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}