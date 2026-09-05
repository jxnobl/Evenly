"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Plus, X, ArrowRight, Loader2, Users, Wallet } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddMember = () => {
    setMembers([...members, ""]);
  };

  const handleRemoveMember = (index: number) => {
    if (members.length > 2) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const handleMemberChange = (index: number, value: string) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  const handleCreateTab = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanMembers = members.map((m) => m.trim()).filter(Boolean);

    if (!cleanTitle || cleanMembers.length < 2 || loading) return;

    setLoading(true);
    setErrorMessage(null);

    const generatedSlug = `${cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}-${Math.random().toString(36).substring(2, 6)}`;

    try {
      const { data: tabData, error: tabError } = await supabase
        .from("tabs")
        .insert([{ title: cleanTitle, slug: generatedSlug }])
        .select()
        .single();

      if (tabError) throw tabError;

      const memberInserts = cleanMembers.map((name) => ({
        tab_id: tabData.id,
        name,
      }));

      const { error: memberError } = await supabase
        .from("tab_members")
        .insert(memberInserts);

      if (memberError) throw memberError;

      router.push(`/tab/${generatedSlug}`);
    } catch (err: any) {
      console.error("Tab creation failed:", err);
      setErrorMessage(err.message || "Failed to create tab. Check connection.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-center px-5 py-12 max-w-md mx-auto">
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-2 border border-emerald-500/20">
          <Wallet size={32} />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Evenly</h1>
        <p className="text-sm text-slate-400">
          Split group expenses and settle up with GCash, Maya, and QR Ph.
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl">
        <form onSubmit={handleCreateTab} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tab Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Boracay Weekend, Samgyup"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1.5 bg-[#1A2234] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={13} /> Group Members
              </label>
              <button
                type="button"
                onClick={handleAddMember}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
              >
                <Plus size={14} /> Add Person
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {members.map((member, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder={`Member ${idx + 1}`}
                    value={member}
                    onChange={(e) => handleMemberChange(idx, e.target.value)}
                    className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-emerald-500 outline-none transition"
                  />
                  {members.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl font-mono">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Create Tab <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}