/* Halaman input nilai kelulusan model leger dengan filter jurusan, download/import Excel, simpan manual, drag urutan mapel, dan tombol print per siswa. */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebaseConfig";

type JurusanItem = {
  id: string;
  nama: string;
};

type MapelSnapshotItem = {
  mapelId: string;
  nama: string;
  kelompok?: "A" | "B" | "C";
};

type SiswaItem = {
  id: string;
  nisn?: string;
  nama: string;
  ttl: string;
  orangTua: string;
  npsn: string;
  programJurusanId: string;
  programJurusanNama: string;
  mapelSnapshot: MapelSnapshotItem[];
  nilaiByMapelId: Record<string, string>;
};

const MAX_BATCH = 400;

function Blob({ from = "#334155", to = "#111827" }) {
  const id = `g${from.replace("#", "")}${to.replace("#", "")}`;

  return (
    <svg viewBox="0 0 300 220" className="h-20 w-32 opacity-90 md:h-24 md:w-36">
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

function moveItem<T>(arr: T[], fromIndex: number, toIndex: number) {
  const copy = [...arr];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[./_-]/g, " ");
}

function cleanNilai(value: unknown) {
  return String(value || "")
    .replace(/[^\d.,]/g, "")
    .replace(",", ".")
    .trim();
}

function getExcelValue(row: Record<string, unknown>, keys: string[]) {
  const entries = Object.entries(row);

  for (const key of keys) {
    const found = entries.find(([rowKey]) => normalizeKey(rowKey) === normalizeKey(key));
    if (found) return normalizeText(found[1]);
  }

  return "";
}

export default function MasukkanNilaiPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingUrutan, setSavingUrutan] = useState(false);
  const [savingNilai, setSavingNilai] = useState(false);
  const [importing, setImporting] = useState(false);

  const [jurusanList, setJurusanList] = useState<JurusanItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);

  const [selectedJurusanId, setSelectedJurusanId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [draggingMapelId, setDraggingMapelId] = useState("");

  const [nilaiDraft, setNilaiDraft] = useState<Record<string, Record<string, string>>>({});

  const jurusanCol = collection(db, "kelulusan_program_jurusan");
  const siswaCol = collection(db, "kelulusan_siswa");

  async function loadJurusan() {
    const snap = await getDocs(jurusanCol);
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<JurusanItem, "id">) }))
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));

    setJurusanList(rows);
    return rows;
  }

  async function loadSiswa() {
    const snap = await getDocs(siswaCol);
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SiswaItem, "id">) }))
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));

    setSiswaList(rows);
    return rows;
  }

  async function loadAll() {
    try {
      setLoading(true);
      const [jurusanRows] = await Promise.all([loadJurusan(), loadSiswa()]);

      setSelectedJurusanId((prev) => {
        if (prev && jurusanRows.some((j) => j.id === prev)) return prev;
        return jurusanRows[0]?.id || "";
      });
    } catch (error) {
      console.error(error);
      alert("⚠️ Gagal memuat data masukkan nilai");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedJurusan = useMemo(
    () => jurusanList.find((item) => item.id === selectedJurusanId) || null,
    [jurusanList, selectedJurusanId]
  );

  const siswaJurusan = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return siswaList
      .filter((item) => item.programJurusanId === selectedJurusanId)
      .filter((item) => {
        if (!q) return true;

        return [item.nama, item.nisn, item.npsn, item.programJurusanNama]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));
  }, [keyword, selectedJurusanId, siswaList]);

  const mapelLeger = useMemo(() => {
    if (!selectedJurusanId) return [];
    return siswaJurusan.find((item) => item.mapelSnapshot?.length)?.mapelSnapshot || [];
  }, [selectedJurusanId, siswaJurusan]);

  function getNilaiTampil(siswa: SiswaItem, mapelId: string) {
    return nilaiDraft[siswa.id]?.[mapelId] ?? siswa.nilaiByMapelId?.[mapelId] ?? "";
  }

  const rataRataPerSiswa = useMemo(() => {
    const result: Record<string, string> = {};

    siswaJurusan.forEach((siswa) => {
      const values = mapelLeger
        .map((mapel) => Number(String(getNilaiTampil(siswa, mapel.mapelId)).replace(",", ".")))
        .filter((value) => !Number.isNaN(value));

      if (!values.length) {
        result[siswa.id] = "";
        return;
      }

      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      result[siswa.id] = avg.toFixed(2);
    });

    return result;
  }, [mapelLeger, siswaJurusan, nilaiDraft]);

  function updateDraftNilai(siswaId: string, mapelId: string, rawValue: string) {
    const value = cleanNilai(rawValue);

    setNilaiDraft((prev) => ({
      ...prev,
      [siswaId]: {
        ...(prev[siswaId] || {}),
        [mapelId]: value,
      },
    }));
  }

  async function saveAllNilai() {
    if (!selectedJurusanId) return alert("❌ Pilih jurusan dulu");

    try {
      setSavingNilai(true);

      const batchItems = siswaJurusan.map((siswa) => {
        const nextNilai: Record<string, string> = {
          ...(siswa.nilaiByMapelId || {}),
        };

        mapelLeger.forEach((mapel) => {
          nextNilai[mapel.mapelId] = getNilaiTampil(siswa, mapel.mapelId);
        });

        return {
          ref: doc(db, "kelulusan_siswa", siswa.id),
          data: {
            nilaiByMapelId: nextNilai,
            updatedAt: serverTimestamp(),
          },
        };
      });

      if (batchItems.length > 0) {
        await commitInChunks(batchItems);
      }

      setNilaiDraft({});
      await loadSiswa();
      alert("✅ Nilai berhasil disimpan");
    } catch (error) {
      console.error(error);
      alert("⚠️ Gagal menyimpan nilai");
      await loadSiswa();
    } finally {
      setSavingNilai(false);
    }
  }

  async function saveUrutanMapel(newOrder: MapelSnapshotItem[]) {
    if (!selectedJurusanId) return;

    try {
      setSavingUrutan(true);

      setSiswaList((prev) =>
        prev.map((item) =>
          item.programJurusanId === selectedJurusanId
            ? {
                ...item,
                mapelSnapshot: newOrder,
              }
            : item
        )
      );

      const targetSiswa = siswaList.filter((item) => item.programJurusanId === selectedJurusanId);
      const batchItems = targetSiswa.map((item) => ({
        ref: doc(db, "kelulusan_siswa", item.id),
        data: {
          mapelSnapshot: newOrder,
          updatedAt: serverTimestamp(),
        },
      }));

      if (batchItems.length > 0) {
        await commitInChunks(batchItems);
      }

      await loadSiswa();
    } catch (error) {
      console.error(error);
      alert("⚠️ Gagal menyimpan urutan mapel");
      await loadSiswa();
    } finally {
      setSavingUrutan(false);
      setDraggingMapelId("");
    }
  }

  async function handleDropMapel(targetMapelId: string) {
    if (!draggingMapelId || draggingMapelId === targetMapelId) return;

    const fromIndex = mapelLeger.findIndex((item) => item.mapelId === draggingMapelId);
    const toIndex = mapelLeger.findIndex((item) => item.mapelId === targetMapelId);

    if (fromIndex < 0 || toIndex < 0) return;

    const newOrder = moveItem(mapelLeger, fromIndex, toIndex);
    await saveUrutanMapel(newOrder);
  }

  function handlePrint(siswaId: string) {
    window.open(`/kelulusan/print/${siswaId}`, "_blank", "noopener,noreferrer");
  }

  function downloadExcel() {
    if (!selectedJurusanId) {
      alert("❌ Pilih jurusan dulu");
      return;
    }

    if (siswaJurusan.length === 0) {
      alert("❌ Belum ada siswa pada jurusan ini");
      return;
    }

    const data = siswaJurusan
      .slice()
      .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"))
      .map((siswa, index) => {
        const row: Record<string, string | number> = {
          No: index + 1,
          "Siswa ID": siswa.id,
          NISN: siswa.nisn || "",
          Nama: siswa.nama || "",
          NPSN: siswa.npsn || "",
          Jurusan: siswa.programJurusanNama || "",
        };

        mapelLeger.forEach((mapel) => {
          row[mapel.nama] = getNilaiTampil(siswa, mapel.mapelId);
        });

        row["Rata-rata"] = rataRataPerSiswa[siswa.id] || "";
        return row;
      });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Nilai Kelulusan");

    const jurusanName = selectedJurusan?.nama || "jurusan";
    XLSX.writeFile(workbook, `nilai-kelulusan-${jurusanName}.xlsx`);
  }

  async function importExcel(file: File) {
    if (!selectedJurusanId) {
      alert("❌ Pilih jurusan dulu");
      return;
    }

    try {
      setImporting(true);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        alert("❌ File Excel tidak memiliki sheet");
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
      });

      if (rows.length === 0) {
        alert("❌ File Excel kosong");
        return;
      }

      const siswaById = new Map(siswaJurusan.map((item) => [item.id, item]));
      const siswaByNisn = new Map(
        siswaJurusan
          .filter((item) => item.nisn)
          .map((item) => [String(item.nisn || "").trim(), item])
      );
      const siswaByNama = new Map(
        siswaJurusan.map((item) => [normalizeKey(item.nama), item])
      );

      const nextDraft: Record<string, Record<string, string>> = {};
      const failedRows: string[] = [];
      let successCount = 0;

      rows.forEach((row, index) => {
        const rowNumber = index + 2;

        const siswaId = getExcelValue(row, ["Siswa ID", "ID Siswa", "ID"]);
        const nisn = getExcelValue(row, ["NISN"]);
        const nama = getExcelValue(row, ["Nama", "Nama Siswa"]);

        const siswa =
          siswaById.get(siswaId) ||
          siswaByNisn.get(nisn) ||
          siswaByNama.get(normalizeKey(nama));

        if (!siswa) {
          failedRows.push(`Baris ${rowNumber}: ${nama || nisn || "Tanpa Nama"} tidak cocok dengan data siswa`);
          return;
        }

        nextDraft[siswa.id] = {
          ...(nextDraft[siswa.id] || {}),
        };

        mapelLeger.forEach((mapel) => {
          const nilai = getExcelValue(row, [mapel.nama, mapel.mapelId]);
          nextDraft[siswa.id][mapel.mapelId] = cleanNilai(nilai);
        });

        successCount++;
      });

      setNilaiDraft((prev) => {
        const merged = { ...prev };

        Object.entries(nextDraft).forEach(([siswaId, nilaiMapel]) => {
          merged[siswaId] = {
            ...(merged[siswaId] || {}),
            ...nilaiMapel,
          };
        });

        return merged;
      });

      if (failedRows.length > 0) {
        alert(
          `✅ Berhasil membaca ${successCount} baris Excel.\n\n⚠️ Gagal:\n${failedRows
            .slice(0, 10)
            .join("\n")}${failedRows.length > 10 ? "\n..." : ""}\n\nKlik tombol Simpan Nilai untuk menyimpan ke Firestore.`
        );
      } else {
        alert(`✅ Berhasil membaca ${successCount} baris Excel. Klik tombol Simpan Nilai untuk menyimpan.`);
      }
    } catch (error) {
      console.error(error);
      alert("⚠️ Gagal import Excel");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-2 py-3 text-black sm:px-3 md:px-4 md:py-4">
      <div className="mx-auto w-full max-w-[1900px] space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-md transition hover:border-slate-300 hover:shadow-xl">
          <div className="w-full rounded-t-2xl bg-slate-900 px-4 py-2 text-sm font-semibold tracking-wide text-white md:px-5">
            Masukkan Nilai Kelulusan
          </div>

          <div className="flex items-center gap-3 px-4 pt-4 md:px-5">
            <Blob from="#2563EB" to="#0F172A" />
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Kelulusan
              </div>
              <div className="text-lg font-black text-slate-800 md:text-xl">
                📘 Leger Nilai Siswa
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Program jurusan aktif: <b>{selectedJurusan?.nama || "Belum dipilih"}</b>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-4 pb-4 pt-3 md:px-5 md:pb-5">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importExcel(file);
              }}
              className="hidden"
            />

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[260px_minmax(0,1fr)_auto] xl:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Filter Program Jurusan
                </label>
                <select
                  value={selectedJurusanId}
                  onChange={(e) => {
                    setSelectedJurusanId(e.target.value);
                    setNilaiDraft({});
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">— Pilih Program Jurusan —</option>
                  {jurusanList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Cari Nama Siswa
                </label>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Cari nama siswa, NISN, atau NPSN..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadExcel}
                  disabled={!selectedJurusanId || siswaJurusan.length === 0}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  Download Excel
                </button>

                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={!selectedJurusanId || importing}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {importing ? "Import..." : "Import Excel"}
                </button>

                <button
                  type="button"
                  onClick={saveAllNilai}
                  disabled={!selectedJurusanId || savingNilai || siswaJurusan.length === 0}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingNilai ? "Menyimpan..." : "Simpan Nilai"}
                </button>
              </div>
            </div>

            {savingUrutan ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Menyimpan urutan mapel...
              </div>
            ) : null}

            {Object.keys(nilaiDraft).length > 0 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                Ada perubahan nilai yang belum disimpan. Klik tombol <b>Simpan Nilai</b>.
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-collapse text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="sticky left-0 z-30 w-10 border border-slate-700 bg-slate-900 px-2 py-2 text-center">
                        No
                      </th>
                      <th className="sticky left-10 z-30 min-w-[190px] border border-slate-700 bg-slate-900 px-2 py-2 text-left">
                        Nama Siswa
                      </th>

                      {mapelLeger.map((mapel) => (
                        <th
                          key={mapel.mapelId}
                          draggable
                          onDragStart={() => setDraggingMapelId(mapel.mapelId)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropMapel(mapel.mapelId)}
                          className="min-w-[105px] cursor-move border border-slate-700 bg-slate-900 px-2 py-2 text-center align-middle transition hover:bg-slate-800"
                          title="Drag header ini untuk ubah urutan mapel"
                        >
                          <div className="flex min-h-[38px] items-center justify-center px-1 text-center">
                            <span className="line-clamp-2 text-[10px] font-black uppercase leading-tight tracking-wide">
                              {mapel.nama}
                            </span>
                          </div>
                        </th>
                      ))}

                      <th className="min-w-[75px] border border-slate-700 bg-slate-900 px-2 py-2 text-center">
                        Rata-rata
                      </th>
                      <th className="sticky right-0 z-30 min-w-[78px] border border-slate-700 bg-slate-900 px-2 py-2 text-center">
                        Print
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={mapelLeger.length + 4} className="p-5 text-center text-slate-500">
                          Memuat...
                        </td>
                      </tr>
                    ) : !selectedJurusanId ? (
                      <tr>
                        <td colSpan={mapelLeger.length + 4} className="p-5 text-center text-slate-500">
                          Pilih program jurusan dulu.
                        </td>
                      </tr>
                    ) : siswaJurusan.length === 0 ? (
                      <tr>
                        <td colSpan={mapelLeger.length + 4} className="p-5 text-center text-slate-500">
                          Belum ada siswa pada jurusan ini.
                        </td>
                      </tr>
                    ) : (
                      siswaJurusan.map((item, i) => (
                        <tr key={item.id} className="odd:bg-white even:bg-slate-50">
                          <td className="sticky left-0 z-20 border border-slate-200 bg-inherit px-2 py-1.5 text-center font-semibold">
                            {i + 1}
                          </td>

                          <td className="sticky left-10 z-20 border border-slate-200 bg-inherit px-2 py-1.5">
                            <div className="text-xs font-bold leading-tight text-slate-800">
                              {item.nama}
                            </div>
                            <div className="mt-0.5 text-[10px] leading-tight text-slate-500">
                              NISN: {item.nisn || "—"} 
                            </div>
                          </td>

                          {mapelLeger.map((mapel) => (
                            <td key={mapel.mapelId} className="border border-slate-200 p-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={getNilaiTampil(item, mapel.mapelId)}
                                onChange={(e) =>
                                  updateDraftNilai(item.id, mapel.mapelId, e.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 px-1.5 py-1 text-center text-xs font-bold text-slate-800 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200"
                                placeholder="0"
                              />
                            </td>
                          ))}

                          <td className="border border-slate-200 px-2 py-1.5 text-center text-xs font-black text-slate-700">
                            {rataRataPerSiswa[item.id] || ""}
                          </td>

                          <td className="sticky right-0 z-20 border border-slate-200 bg-inherit px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handlePrint(item.id)}
                              className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-slate-800"
                            >
                              Print
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

           
          </div>
        </div>
      </div>
    </div>
  );
}