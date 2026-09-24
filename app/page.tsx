"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, History, ArrowRight, Trash2, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { computeSettlements, Member, Expense, PaymentRecord } from "@/lib/algorithm";
import { ThemeToggle } from "@/components/theme-toggle";

interface RecentTab {
  slug: string;
  title: string;
  lastVisited: number;
}

interface TabStatus {
  isSettled: boolean;
  unsettledAmount: number;
  loading: boolean;
}

export default function HomePage() {
  const [recentTabs, setRecentTabs] = useState<RecentTab[]>([]);
  const [tabStatuses, setTabStatuses] = useState<Record<string, TabStatus>>({});

  const fetchTabsSettlementStatus = useCallback(async (tabs: RecentTab[]) => {
    if (tabs.length === 0) return;

    try {
      const slugs = tabs.map((t) => t.slug);

      const { data: tabsData, error: tabErr } = await supabase
        .from("tabs")
        .select("id, slug")
        .in("slug", slugs);

      if (tabErr || !tabsData || tabsData.length === 0) return;

      const tabIds = tabsData.map((t) => t.id);

      const [membersRes, expensesRes, splitsRes, paymentsRes] = await Promise.all([
        supabase.from("tab_members").select("id, tab_id, name").in("tab_id", tabIds),
        supabase.from("expenses").select("id, tab_id, payer_member_id, amount").in("tab_id", tabIds),
        supabase.from("expense_splits").select("expense_id, member_id, amount_owed"),
        supabase.from("payments").select("tab_id, payer_id, receiver_id, amount").in("tab_id", tabIds),
      ]);

      const membersByTab: Record<string, Member[]> = {};
      (membersRes.data || []).forEach((m) => {
        if (!membersByTab[m.tab_id]) membersByTab[m.tab_id] = [];
        membersByTab[m.tab_id].push({ id: m.id, name: m.name });
      });

      const splitsByExpense: Record<string, { memberId: string; amountOwed: number }[]> = {};
      (splitsRes.data || []).forEach((s) => {
        if (!splitsByExpense[s.expense_id]) splitsByExpense[s.expense_id] = [];
        splitsByExpense[s.expense_id].push({
          memberId: s.member_id,
          amountOwed: Number(s.amount_owed),
        });
      });

      const expensesByTab: Record<string, Expense[]> = {};
      (expensesRes.data || []).forEach((e) => {
        if (!expensesByTab[e.tab_id]) expensesByTab[e.tab_id] = [];
        expensesByTab[e.tab_id].push({
          id: e.id,
          payerMemberId: e.payer_member_id,
          amount: Number(e.amount),
          splits: splitsByExpense[e.id] || [],
        });
      });

      const paymentsByTab: Record<string, PaymentRecord[]> = {};
      (paymentsRes.data || []).forEach((p) => {
        if (!paymentsByTab[p.tab_id]) paymentsByTab[p.tab_id] = [];
        paymentsByTab[p.tab_id].push({
          payer_id: p.payer_id,
          receiver_id: p.receiver_id,
          amount: Number(p.amount),
        });
      });

      const statuses: Record<string, TabStatus> = {};

      tabsData.forEach((t) => {
        const mems = membersByTab[t.id] || [];
        const exps = expensesByTab[t.id] || [];
        const pays = paymentsByTab[t.id] || [];

        const settlements = computeSettlements(mems, exps, pays);
        const totalRemaining = settlements.reduce((sum, s) => sum + s.amount, 0);

        statuses[t.slug] = {
          isSettled: settlements.length === 0,
          unsettledAmount: Math.round(totalRemaining * 100) / 100,
          loading: false,
        };
      });

      setTabStatuses((prev) => ({ ...prev, ...statuses }));
    } catch (err) {
      console.error("Failed to load status for tabs:", err);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("evenly_recent_tabs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentTabs(parsed);
          fetchTabsSettlementStatus(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to read tabs from localStorage:", e);
    }
  }, [fetchTabsSettlementStatus]);

  const removeRecentTab = (slugToRemove: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = recentTabs.filter((t) => t.slug !== slugToRemove);
    setRecentTabs(updated);
    localStorage.setItem("evenly_recent_tabs", JSON.stringify(updated));
  };

  return (
    <main className="min-h-screen max-w-md mx-auto p-5 pb-24 relative flex flex-col justify-between">
      <div className="space-y-6">
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5">
            <Image
              src="/icon.svg"
              alt="Evenly Logo"
              width={26}
              height={26}
              className="rounded-md"
              priority
            />
            <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">Evenly</span>
          </div>
          <ThemeToggle />
        </header>

        <section className="space-y-2 py-4">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
            Split expenses without friction.
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            No sign-ups, no apps to install. Create a tab, share the link, and settle debts instantly via GCash, Maya, or QR Ph.
          </p>
        </section>

        <Link
          href="/new"
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition text-sm"
        >
          <Plus size={18} /> Create a Tab
        </Link>

        {recentTabs.length > 0 && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <History size={14} className="text-emerald-500" /> Recent Tabs
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">{recentTabs.length} tabs</span>
            </div>

            <div className="space-y-2.5">
              {recentTabs.map((tab) => {
                const status = tabStatuses[tab.slug];

                return (
                  <Link
                    key={tab.slug}
                    href={`/tab/${tab.slug}`}
                    className="group block p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:border-emerald-500/30 transition duration-200 shadow-sm relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 pr-2">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-emerald-500 transition">
                          {tab.title}
                        </h3>

                        {status ? (
                          status.isSettled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} /> All settled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              <Clock size={12} /> ₱{status.unsettledAmount.toFixed(2)} unsettled
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 animate-pulse">View tab &rarr;</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => removeRecentTab(tab.slug, e)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition rounded-lg"
                          title="Remove from history"
                        >
                          <Trash2 size={14} />
                        </button>
                        <div className="p-1.5 rounded-xl bg-black/5 dark:bg-white/[0.04] text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition">
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <footer className="text-center pt-8 text-[11px] text-slate-400 dark:text-slate-500 tracking-wide">
        <span>Evenly</span>
        <span className="mx-1.5 opacity-40">·</span>
        <span>Built by <span className="font-semibold text-slate-600 dark:text-slate-300">EJO</span></span>
      </footer>
    </main>
  );
}