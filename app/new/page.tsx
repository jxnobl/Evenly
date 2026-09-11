"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme-toggle";

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base || "tab"}-${randomSuffix}`;
}

export default function NewTabPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);

  const handleMemberChange = (index: number, value: string) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  const addMemberField = () => {
    setMembers([...members, ""]);
  };

  const removeMemberField = (index: number) => {
    if (members.length <= 2) return;
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const cleanTitle = title.trim();
    const cleanMembers = members.map((m) => m.trim()).filter(Boolean);

    if (!cleanTitle) {
      alert("Please enter a title for this tab.");
      return;
    }

    if (cleanMembers.length < 2) {
      alert("Please add at least 2 members.");
      return;
    }

    const uniqueMembers = Array.from(new Set(cleanMembers));
    if (uniqueMembers.length !== cleanMembers.length) {
      alert("Member names must be unique.");
      return;
    }

    setLoading(true);

    try {
      const slug = generateSlug(cleanTitle);

      const { data: tabData, error: tabError } = await supabase
        .from("tabs")
        .insert([{ title: cleanTitle, slug }])
        .select()
        .single();

      if (tabError) throw tabError;

      const membersToInsert = cleanMembers.map((name) => ({
        tab_id: tabData.id,
        name,
      }));

      const { error: membersError } = await supabase
        .from("tab_members")
        .insert(membersToInsert);

      if (membersError) throw membersError;

      try {
        const existing = JSON.parse(localStorage.getItem("evenly_recent_tabs") || "[]");
        const updated = [{ slug: tabData.slug, title: tabData.title, lastVisited: Date.now() }, ...existing].slice(0, 10);
        localStorage.setItem("evenly_recent_tabs", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to update recent tabs:", err);
      }

      router.push(`/tab/${slug}`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create tab. Check Supabase connection.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen max-w-md mx-auto p-5 pb-20 relative flex flex-col justify-between">
      <div className="space-y-6">
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-xl bg-black/5 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white active:scale-95 transition"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="font-bold text-base text-slate-900 dark:text-white">Create New Tab</h1>
          </div>
          <ThemeToggle />
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tab Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Samgyup Night, Boracay 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              className="w-full mt-1.5 bg-white dark:bg-[#121824] border border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Members (Min. 2)
              </label>
              <button
                type="button"
                onClick={addMemberField}
                disabled={loading}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Add person
              </button>
            </div>

            <div className="space-y-2.5">
              {members.map((member, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder={`Member ${idx + 1}`}
                    value={member}
                    onChange={(e) => handleMemberChange(idx, e.target.value)}
                    disabled={loading}
                    className="flex-1 bg-white dark:bg-[#121824] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition shadow-sm"
                  />
                  {members.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMemberField(idx)}
                      disabled={loading}
                      className="p-3 text-slate-400 hover:text-rose-500 rounded-xl active:scale-90 transition"
                      title="Remove member"
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
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition text-sm disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Sparkles size={16} /> Generate Tab
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}