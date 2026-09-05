"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, ArrowRight, Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [tabName, setTabName] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddMember = () => setMembers([...members, ""]);
  const handleRemoveMember = (idx: number) => {
    if (members.length > 2) {
      setMembers(members.filter((_, i) => i !== idx));
    }
  };

  const handleMemberChange = (idx: number, val: string) => {
    const updated = [...members];
    updated[idx] = val;
    setMembers(updated);
  };

  const handleCreateTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validMembers = members.map((m) => m.trim()).filter(Boolean);
    if (!tabName.trim() || validMembers.length < 2) {
      const msg = "Please provide a tab name and at least 2 members.";
      setErrorMsg(msg);
      alert(msg);
      return;
    }

    setLoading(true);

    try {
      const rawTitle = tabName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const cleanSlug = `${rawTitle || "tab"}-${Math.random().toString(36).substring(2, 7)}`;

      const { data: tabData, error: tabError } = await supabase
        .from("tabs")
        .insert([{ title: tabName.trim(), slug: cleanSlug }])
        .select("id, slug")
        .single();

      if (tabError || !tabData) {
        throw new Error(tabError?.message || "Failed to create tab in Supabase");
      }

      const memberRows = validMembers.map((name) => ({
        tab_id: tabData.id,
        name,
      }));

      const { error: memError } = await supabase
        .from("tab_members")
        .insert(memberRows);

      if (memError) {
        throw new Error(memError.message);
      }

      router.push(`/tab/${tabData.slug}`);
    } catch (err: any) {
      console.error("Tab creation failed:", err);
      const msg = err.message || JSON.stringify(err);
      setErrorMsg(msg);
      alert(`Error creating tab: ${msg}`);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-center px-5 py-12 max-w-md mx-auto">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Evenly</h1>
        <p className="text-sm text-slate-400">Frictionless expense splitting & instant settlement.</p>
      </div>

      <form onSubmit={handleCreateTab} className="space-y-5 bg-white/[0.03] border border-white/10 p-6 rounded-2xl backdrop-blur-md">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold uppercase text-slate-400">Tab Title</label>
          <input
            type="text"
            placeholder="e.g. Baguio Trip, Friday Dinner"
            value={tabName}
            onChange={(e) => setTabName(e.target.value)}
            required
            className="w-full mt-1.5 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase text-slate-400">Members</label>
          {members.map((member, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                placeholder={`Member ${idx + 1}`}
                value={member}
                onChange={(e) => handleMemberChange(idx, e.target.value)}
                required
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-emerald-500 outline-none"
              />
              {members.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(idx)}
                  className="p-2.5 text-slate-500 hover:text-rose-400 bg-white/[0.02] rounded-xl border border-white/5"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddMember}
            className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-1 hover:underline"
          >
            <Plus size={14} /> Add another member
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              Create Shared Tab <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </main>
  );
}