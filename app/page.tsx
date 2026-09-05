"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowRight, Wallet2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);

  const addMemberField = () => setMembers([...members, ""]);
  const removeMemberField = (idx: number) => {
    if (members.length > 2) {
      setMembers(members.filter((_, i) => i !== idx));
    }
  };

  const handleMemberChange = (idx: number, val: string) => {
    const updated = [...members];
    updated[idx] = val;
    setMembers(updated);
  };

  const handleCreateTab = (e: React.FormEvent) => {
    e.preventDefault();
    const validMembers = members.map((m) => m.trim()).filter(Boolean);
    if (!title.trim() || validMembers.length < 2) return;

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).substring(2, 6);
    
    // Store in localStorage for client-side prototype
    const tabData = {
      slug,
      title: title.trim(),
      members: validMembers.map((name, i) => ({ id: `m_${i + 1}`, name })),
      expenses: [],
    };
    localStorage.setItem(`tab_${slug}`, JSON.stringify(tabData));

    router.push(`/tab/${slug}`);
  };

  return (
    <main className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-between p-6 max-w-md mx-auto">
      <header className="pt-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
            E
          </div>
          <span className="text-xl font-black tracking-tight text-white">evenly</span>
        </div>
        <p className="text-sm text-slate-400">Split the bill. Settle instantly. Zero math.</p>
      </header>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <form onSubmit={handleCreateTab} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Tab Name
            </label>
            <input
              type="text"
              placeholder="e.g. Samgyup Friday, Baguio Roadtrip"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Who's splitting?
              </label>
              <button
                type="button"
                onClick={addMemberField}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                <Plus size={14} /> Add Person
              </button>
            </div>

            <div className="space-y-2">
              {members.map((name, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Person ${idx + 1}`}
                    value={name}
                    onChange={(e) => handleMemberChange(idx, e.target.value)}
                    required
                    className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  {members.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMemberField(idx)}
                      className="p-2.5 text-slate-500 hover:text-rose-400 rounded-xl bg-white/[0.02]"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition duration-150 shadow-lg shadow-emerald-500/20 text-sm mt-4"
          >
            Create Shared Tab <ArrowRight size={16} />
          </button>
        </form>
      </div>

      <footer className="py-4 text-center text-xs text-slate-600 flex items-center justify-center gap-1">
        <Wallet2 size={14} /> Built for QR Ph, GCash & Maya settlements
      </footer>
    </main>
  );
}