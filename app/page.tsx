"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Sparkles, Plus, X, ArrowRight, Loader2, 
  Layers, ShieldCheck, Zap 
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddMember = () => setMembers([...members, ""]);
  const handleRemoveMember = (idx: number) => {
    if (members.length > 2) setMembers(members.filter((_, i) => i !== idx));
  };

  const handleMemberChange = (idx: number, val: string) => {
    const updated = [...members];
    updated[idx] = val;
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
      const { data: tabData, error: tabErr } = await supabase
        .from("tabs")
        .insert([{ title: cleanTitle, slug: generatedSlug }])
        .select()
        .single();

      if (tabErr) throw tabErr;

      const memberInserts = cleanMembers.map((name) => ({
        tab_id: tabData.id,
        name,
      }));

      const { error: memErr } = await supabase
        .from("tab_members")
        .insert(memberInserts);

      if (memErr) throw memErr;

      router.push(`/tab/${generatedSlug}`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to create tab. Check connection.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen max-w-xl mx-auto px-5 py-16 flex flex-col justify-center">
      {/* Precision Badge */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 backdrop-blur-md">
          <Sparkles size={12} className="text-[#6872D9]" />
          <span className="text-[11px] font-mono tracking-wider uppercase text-[#EDEDEF]">
            Precision Group Splitting
          </span>
        </div>
      </div>

      {/* Hero Headline */}
      <div className="text-center space-y-3 mb-10">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] bg-gradient-to-b from-white via-white/95 to-white/60 bg-clip-text text-transparent">
          Split expenses. <br />
          Settle in seconds.
        </h1>
        <p className="text-sm sm:text-base text-[#8A8F98] max-w-sm mx-auto font-normal leading-relaxed">
          Zero login friction. Real-time balance optimization with instant GCash and Maya settlements.
        </p>
      </div>

      {/* Creation Card */}
      <SpotlightCard className="p-6 sm:p-8">
        <form onSubmit={handleCreateTab} className="space-y-6">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98]">
              Tab Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Siargao Trip, Friday Dinner"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-2 bg-[#0a0a0c] border border-white/10 rounded-xl px-4 py-3 text-sm text-[#EDEDEF] placeholder-[#8A8F98]/50 focus:border-[#5E6AD2] focus:ring-2 focus:ring-[#5E6AD2]/30 outline-none transition duration-200"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98]">
                Participants ({members.length})
              </label>
              <button
                type="button"
                onClick={handleAddMember}
                className="text-xs text-[#6872D9] hover:text-white flex items-center gap-1 font-medium transition"
              >
                <Plus size={13} /> Add Person
              </button>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {members.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#8A8F98]/60 w-5">
                    0{idx + 1}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={`Member ${idx + 1}`}
                    value={m}
                    onChange={(e) => handleMemberChange(idx, e.target.value)}
                    className="flex-1 bg-[#0a0a0c] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#EDEDEF] placeholder-[#8A8F98]/40 focus:border-[#5E6AD2] outline-none transition"
                  />
                  {members.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="p-2 text-[#8A8F98] hover:text-rose-400 rounded-lg transition"
                    >
                      <X size={14} />
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
            className="w-full bg-[#5E6AD2] hover:bg-[#6872D9] text-white font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-linear-cta active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Create Tab <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </SpotlightCard>

      {/* Micro Feature Proofs */}
      <div className="grid grid-cols-3 gap-3 mt-8">
        <div className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.015] text-center space-y-1">
          <Zap size={14} className="mx-auto text-[#6872D9]" />
          <p className="text-[11px] text-[#8A8F98]">Instant Sync</p>
        </div>
        <div className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.015] text-center space-y-1">
          <Layers size={14} className="mx-auto text-[#6872D9]" />
          <p className="text-[11px] text-[#8A8F98]">Minimum Debts</p>
        </div>
        <div className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.015] text-center space-y-1">
          <ShieldCheck size={14} className="mx-auto text-[#6872D9]" />
          <p className="text-[11px] text-[#8A8F98]">Direct QR Pay</p>
        </div>
      </div>
    </main>
  );
}