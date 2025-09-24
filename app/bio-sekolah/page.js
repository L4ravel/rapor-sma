"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ---------- UI helper: Section Card ---------- */
function SectionCard({ title, children }) {
  return (
    <div className="relative bg-white/95 border border-slate-200 rounded-3xl shadow-md overflow-hidden">
      <div className="bg-slate-900 text-white w-full px-6 py-3 text-sm md:text-base font-semibold tracking-wide rounded-t-3xl">
        {title}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function BioSekolahPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nama_sekolah: "",
    alamat: "",
    fase: "",
    kepala_sekolah: "",
  });

  const [preview, setPreview] = useState({
    nama_sekolah: "",
    alamat: "",
    fase: "",
    kepala_sekolah: "",
    updatedAt: null,
  });

  const ref = doc(db, "bio_sekolah", "default"); // single doc pusat

  /* -------- Load data on mount -------- */
  useEffect(() => {
    const run = async () => {
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() || {};
          setForm({
            nama_sekolah: d.nama_sekolah || "",
            alamat: d.alamat || "",
            fase: d.fase || "",
            kepala_sekolah: d.kepala_sekolah || "",
          });
          setPreview({
            nama_sekolah: d.nama_sekolah || "",
            alamat: d.alamat || "",
            fase: d.fase || "",
            kepala_sekolah: d.kepala_sekolah || "",
            updatedAt: d.updatedAt || d.createdAt || null,
          });
        }
      } catch (e) {
        console.error("Gagal memuat bio sekolah:", e);
        alert("⚠️ Gagal memuat data bio sekolah");
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- Handlers -------- */
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.nama_sekolah?.trim() || !form.alamat?.trim()) {
      alert("❌ Nama sekolah & Alamat wajib diisi");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        nama_sekolah: form.nama_sekolah.trim(),
        alamat: form.alamat.trim(),
        fase: form.fase.trim(),
        kepala_sekolah: form.kepala_sekolah.trim(),
        updatedAt: serverTimestamp(),
      };
      // buat createdAt saat pertama kali
      const firstLoad = !preview.nama_sekolah && !preview.alamat && !preview.fase && !preview.kepala_sekolah;
      await setDoc(ref, firstLoad ? { ...payload, createdAt: serverTimestamp() } : payload, { merge: true });

      setPreview((p) => ({
        ...p,
        ...payload,
      }));
      alert("✅ Bio sekolah disimpan");
    } catch (e) {
      console.error(e);
      alert("⚠️ Gagal menyimpan bio sekolah");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6 text-black">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* ======= FORM ======= */}
        <SectionCard title="🏫 Bio Sekolah">
          {loading ? (
            <p className="text-center text-slate-600">⏳ Memuat...</p>
          ) : (
            <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1">Nama Sekolah</label>
                <input
                  type="text"
                  name="nama_sekolah"
                  value={form.nama_sekolah}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="SMAS ISLAM ASSUNNAH BAGEK NYAKA"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1">Alamat</label>
                <textarea
                  name="alamat"
                  rows={3}
                  value={form.alamat}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y"
                  placeholder="Jln. Raya Lab. Lombok Km.55 ..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">Fase</label>
                <input
                  type="text"
                  name="fase"
                  value={form.fase}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Contoh: Fase E (SMA)"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  name="kepala_sekolah"
                  value={form.kepala_sekolah}
                  onChange={onChange}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Nama Kepala Sekolah"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2 mt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md px-5 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          )}
                 </SectionCard>

        {/* ======= PRATINJAU ======= */}
        <SectionCard title="🧾 Pratinjau">
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full border-collapse text-sm">
              <tbody className="text-slate-800">
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 border border-slate-200 w-48">Nama Sekolah</td>
                  <td className="px-4 py-2 border border-slate-200">{preview.nama_sekolah || "—"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border border-slate-200">Alamat</td>
                  <td className="px-4 py-2 border border-slate-200 whitespace-pre-wrap break-words">
                    {preview.alamat || "—"}
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 border border-slate-200">Fase</td>
                  <td className="px-4 py-2 border border-slate-200">{preview.fase || "—"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border border-slate-200">Kepala Sekolah</td>
                  <td className="px-4 py-2 border border-slate-200">{preview.kepala_sekolah || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {preview.updatedAt && (
            <p className="mt-3 text-xs text-slate-500">
              Terakhir diperbarui.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
