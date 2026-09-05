"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { computeSettlements, Member, Expense, Settlement, PaymentRecord } from "@/lib/algorithm";
import { 
  ArrowLeft, Plus, QrCode, Check, 
  Receipt, Wallet, Share2, X, Loader2,
  Copy, Edit3, Smartphone, CheckCircle2, Trash2, Pencil,
  History, ChevronDown, ChevronUp, RotateCcw, AlertCircle,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface TabRecord {
  id: string;
  slug: string;
  title: string;
}

interface FullMember extends Member {
  payment_method?: string;
  account_number?: string;
}

interface DetailedExpense extends Expense {
  title?: string;
}

interface DetailedPayment extends PaymentRecord {
  id?: string;
  created_at?: string;
}

export default function TabPage() {
  const routeParams = useParams();
  const slug = Array.isArray(routeParams?.slug)
    ? routeParams.slug[0]
    : (routeParams?.slug as string) || "";

  const [tab, setTab] = useState<TabRecord | null>(null);
  const [members, setMembers] = useState<FullMember[]>([]);
  const [expenses, setExpenses] = useState<DetailedExpense[]>([]);
  const [payments, setPayments] = useState<DetailedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [inspectingExpense, setInspectingExpense] = useState<DetailedExpense | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Add Member State
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const [showHistory, setShowHistory] = useState(true);
  const [activeSettlement, setActiveSettlement] = useState<Settlement | null>(null);
  const [copied, setCopied] = useState(false);
  const [settling, setSettling] = useState(false);

  // Payment profile state
  const [editPaymentMethod, setEditPaymentMethod] = useState("GCash");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Expense form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "exact">("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({});
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const fetchTabData = useCallback(async () => {
    if (!slug) return;

    try {
      setFetchError(null);

      const { data: tabData, error: tabErr } = await supabase
        .from("tabs")
        .select("id, slug, title")
        .eq("slug", slug)
        .maybeSingle();

      if (tabErr) throw tabErr;
      if (!tabData) {
        setTab(null);
        setLoading(false);
        return;
      }
      setTab(tabData);

      // Save tab to local recent tabs history
      try {
        const existing = JSON.parse(localStorage.getItem("evenly_recent_tabs") || "[]");
        const filtered = existing.filter((item: { slug: string }) => item.slug !== tabData.slug);
        const updated = [{ slug: tabData.slug, title: tabData.title, lastVisited: Date.now() }, ...filtered].slice(0, 10);
        localStorage.setItem("evenly_recent_tabs", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save tab history:", e);
      }

      const { data: memberData, error: memErr } = await supabase
        .from("tab_members")
        .select("id, name, payment_method, account_number")
        .eq("tab_id", tabData.id);

      if (memErr) throw memErr;
      const mems = memberData || [];
      setMembers(mems);

      if (mems.length > 0 && !payerId) {
        setPayerId(mems[0].id);
        setSelectedMembers(mems.map((m) => m.id));
      }

      const { data: rawExpenses, error: expErr } = await supabase
        .from("expenses")
        .select("id, title, payer_member_id, amount")
        .eq("tab_id", tabData.id)
        .order("created_at", { ascending: false });

      if (expErr) throw expErr;

      const expenseIds = (rawExpenses || []).map((e) => e.id);
      let splitsByExpense: Record<string, { memberId: string; amountOwed: number }[]> = {};

      if (expenseIds.length > 0) {
        const { data: splitRows, error: splitErr } = await supabase
          .from("expense_splits")
          .select("expense_id, member_id, amount_owed")
          .in("expense_id", expenseIds);

        if (!splitErr && splitRows) {
          splitRows.forEach((s) => {
            if (!splitsByExpense[s.expense_id]) splitsByExpense[s.expense_id] = [];
            splitsByExpense[s.expense_id].push({
              memberId: s.member_id,
              amountOwed: Number(s.amount_owed),
            });
          });
        }
      }

      const formattedExpenses: DetailedExpense[] = (rawExpenses || []).map((e) => ({
        id: e.id,
        title: e.title,
        payerMemberId: e.payer_member_id,
        amount: Number(e.amount),
        splits: splitsByExpense[e.id] || [],
      }));

      setExpenses(formattedExpenses);

      const { data: payData, error: payErr } = await supabase
        .from("payments")
        .select("id, payer_id, receiver_id, amount, created_at")
        .eq("tab_id", tabData.id)
        .order("created_at", { ascending: false });

      if (!payErr && payData) {
        setPayments(
          payData.map((p) => ({
            id: p.id,
            payer_id: p.payer_id,
            receiver_id: p.receiver_id,
            amount: Number(p.amount),
            created_at: p.created_at,
          }))
        );
      }
    } catch (err: any) {
      console.error("fetchTabData error:", err);
      setFetchError(err.message || "Failed to load tab data");
    } finally {
      setLoading(false);
    }
  }, [slug, payerId]);

  useEffect(() => {
    fetchTabData();

    const savedUser = localStorage.getItem(`user_${slug}`);
    if (savedUser) setCurrentMemberId(savedUser);

    const channel = supabase
      .channel(`tab-realtime-${slug}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => fetchTabData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tab_members" }, () => fetchTabData())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => fetchTabData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, fetchTabData]);

  const handleClaimIdentity = (id: string) => {
    setCurrentMemberId(id);
    localStorage.setItem(`user_${slug}`, id);
    const target = members.find((m) => m.id === id);
    if (target) {
      setEditPaymentMethod(target.payment_method || "GCash");
      setEditAccountNumber(target.account_number || "");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMemberId || savingProfile) return;

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("tab_members")
        .update({
          payment_method: editPaymentMethod,
          account_number: editAccountNumber.trim(),
        })
        .eq("id", currentMemberId);

      if (error) throw error;
      setIsProfileModalOpen(false);
      await fetchTabData();
    } catch (err: any) {
      alert(err.message || "Failed to update payment info");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMemberName.trim();
    if (!tab || !cleanName || addingMember) return;

    setAddingMember(true);
    try {
      const { error } = await supabase
        .from("tab_members")
        .insert([{ tab_id: tab.id, name: cleanName }]);

      if (error) throw error;

      setNewMemberName("");
      setIsAddMemberModalOpen(false);
      await fetchTabData();
    } catch (err: any) {
      alert(err.message || "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const openNewExpenseModal = () => {
    setEditingExpenseId(null);
    setTitle("");
    setAmount("");
    setSplitMode("equal");
    if (members.length > 0) {
      setPayerId(members[0].id);
      setSelectedMembers(members.map((m) => m.id));
      const initialExact: Record<string, string> = {};
      members.forEach((m) => {
        initialExact[m.id] = "";
      });
      setExactSplits(initialExact);
    }
    setIsExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: DetailedExpense) => {
    setEditingExpenseId(exp.id);
    setTitle(exp.title || "");
    setAmount(exp.amount.toString());
    setPayerId(exp.payerMemberId);

    const splitMembers = exp.splits.map((s) => s.memberId);
    setSelectedMembers(splitMembers);

    const isEven =
      exp.splits.length > 0 &&
      exp.splits.every(
        (s) => Math.abs(s.amountOwed - exp.amount / exp.splits.length) < 0.05
      );

    setSplitMode(isEven ? "equal" : "exact");

    const exactMap: Record<string, string> = {};
    members.forEach((m) => {
      const found = exp.splits.find((s) => s.memberId === m.id);
      exactMap[m.id] = found ? found.amountOwed.toString() : "";
    });
    setExactSplits(exactMap);

    setIsExpenseModalOpen(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      if (inspectingExpense?.id === id) setInspectingExpense(null);
      await fetchTabData();
    } catch (err: any) {
      alert(err.message || "Failed to delete expense");
    }
  };

  const handleDeletePayment = async (id?: string) => {
    if (!id) return;
    if (!confirm("Undo this payment? The balance will revert to owed.")) return;

    try {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
      await fetchTabData();
    } catch (err: any) {
      alert(err.message || "Failed to undo payment");
    }
  };

  const totalExactAllocated = Object.values(exactSplits).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(amount);
    if (!tab || !title.trim() || isNaN(total) || total <= 0 || submittingExpense) return;

    let splitsToInsert: { expense_id?: string; member_id: string; amount_owed: number }[] = [];

    if (splitMode === "equal") {
      if (selectedMembers.length === 0) {
        alert("Select at least one member to split with.");
        return;
      }
      const splitAmount = Math.round((total / selectedMembers.length) * 100) / 100;
      splitsToInsert = selectedMembers.map((mId) => ({
        member_id: mId,
        amount_owed: splitAmount,
      }));
    } else {
      if (Math.abs(totalExactAllocated - total) > 0.05) {
        alert(
          `The sum of custom shares (₱${totalExactAllocated.toFixed(2)}) must match the total expense (₱${total.toFixed(2)}).`
        );
        return;
      }
      splitsToInsert = Object.entries(exactSplits)
        .map(([mId, val]) => ({
          member_id: mId,
          amount_owed: parseFloat(val) || 0,
        }))
        .filter((s) => s.amount_owed > 0);

      if (splitsToInsert.length === 0) {
        alert("Enter at least one valid amount owed.");
        return;
      }
    }

    setSubmittingExpense(true);
    try {
      if (editingExpenseId) {
        const { error: expUpdateErr } = await supabase
          .from("expenses")
          .update({
            title: title.trim(),
            amount: total,
            payer_member_id: payerId,
          })
          .eq("id", editingExpenseId);

        if (expUpdateErr) throw expUpdateErr;

        await supabase.from("expense_splits").delete().eq("expense_id", editingExpenseId);

        const mappedSplits = splitsToInsert.map((s) => ({
          ...s,
          expense_id: editingExpenseId,
        }));

        const { error: splitErr } = await supabase.from("expense_splits").insert(mappedSplits);
        if (splitErr) throw splitErr;
      } else {
        const { data: expData, error: expError } = await supabase
          .from("expenses")
          .insert([
            {
              tab_id: tab.id,
              payer_member_id: payerId,
              title: title.trim(),
              amount: total,
            },
          ])
          .select()
          .single();

        if (expError) throw expError;

        const mappedSplits = splitsToInsert.map((s) => ({
          ...s,
          expense_id: expData.id,
        }));

        const { error: splitError } = await supabase.from("expense_splits").insert(mappedSplits);
        if (splitError) throw splitError;
      }

      setIsExpenseModalOpen(false);
      await fetchTabData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to save expense");
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleConfirmSettlement = async (s: Settlement) => {
    if (!tab || settling) return;
    setSettling(true);
    try {
      const { error } = await supabase.from("payments").insert([
        {
          tab_id: tab.id,
          payer_id: s.debtorId,
          receiver_id: s.creditorId,
          amount: s.amount,
        },
      ]);
      if (error) throw error;
      setActiveSettlement(null);
      await fetchTabData();
    } catch (err: any) {
      alert(err.message || "Failed to settle payment");
    } finally {
      setSettling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin text-emerald-400" />
        <span>Loading Tab...</span>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center text-slate-400 gap-3 p-6 text-center">
        <p className="text-white font-semibold">Tab not found</p>
        <p className="text-sm text-slate-500">
          {fetchError ? `Error: ${fetchError}` : `No tab found matching slug "${slug}".`}
        </p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-semibold text-sm">
          Return Home
        </Link>
      </div>
    );
  }

  const settlements = computeSettlements(members, expenses, payments);
  const getMember = (id: string) => members.find((m) => m.id === id);

  return (
    <main className="min-h-screen bg-[#0B0F17] text-slate-100 max-w-md mx-auto pb-28 relative">
      <header className="sticky top-0 z-20 bg-[#0B0F17]/80 backdrop-blur-md px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-xl bg-white/[0.03] text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-bold text-base text-white leading-tight">{tab.title}</h1>
            <p className="text-xs text-slate-500">{members.length} members</p>
          </div>
        </div>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert("Invite link copied to clipboard!");
          }}
          className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
        >
          <Share2 size={18} />
        </button>
      </header>

      {/* Identity Selector & Add Member Button */}
      <section className="px-5 py-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 pr-2">
          <span className="text-xs text-slate-500 shrink-0 font-medium">You:</span>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => handleClaimIdentity(m.id)}
              className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition ${
                currentMemberId === m.id
                  ? "bg-emerald-500 text-black font-semibold"
                  : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsAddMemberModalOpen(true)}
            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-white/[0.04] transition"
            title="Add new member to this tab"
          >
            <UserPlus size={16} />
          </button>

          {currentMemberId && (
            <button
              onClick={() => {
                const current = getMember(currentMemberId);
                if (current) {
                  setEditPaymentMethod(current.payment_method || "GCash");
                  setEditAccountNumber(current.account_number || "");
                }
                setIsProfileModalOpen(true);
              }}
              className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-white/[0.04] transition"
              title="Edit payment info"
            >
              <Edit3 size={15} />
            </button>
          )}
        </div>
      </section>

      <div className="p-5 space-y-6">
        {/* Settlements */}
        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wallet size={14} className="text-emerald-400" /> Suggested Settle Up
            </h2>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-mono">
              {settlements.length} left
            </span>
          </div>

          {settlements.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              🎉 Everyone is fully settled up!
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s, idx) => {
                const creditor = getMember(s.creditorId);
                const debtor = getMember(s.debtorId);

                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="text-sm">
                      <span className="font-semibold text-rose-400">{debtor?.name}</span>
                      <span className="text-slate-500 mx-1.5">&rarr;</span>
                      <span className="font-semibold text-emerald-400">{creditor?.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white text-sm">₱{s.amount.toFixed(2)}</span>
                      <button
                        onClick={() => {
                          setActiveSettlement(s);
                          setCopied(false);
                        }}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <QrCode size={13} /> Settle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Expenses List */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Receipt size={14} className="text-emerald-400" /> Logged Expenses
          </h2>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-600">
              No expenses recorded yet. Tap below to add one.
            </div>
          ) : (
            expenses.map((exp) => (
              <div 
                key={exp.id} 
                onClick={() => setInspectingExpense(exp)}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 cursor-pointer hover:border-white/10 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{exp.title || "Expense"}</p>
                    <p className="text-xs text-slate-400">
                      <span className="text-emerald-400 font-medium">{getMember(exp.payerMemberId)?.name}</span> paid · {exp.splits.length} split
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <p className="font-mono font-bold text-emerald-400">₱{exp.amount.toFixed(2)}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditExpenseModal(exp)}
                        className="p-1.5 text-slate-500 hover:text-white rounded-lg transition"
                        title="Edit expense"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                        title="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Payment History Log */}
        {payments.length > 0 && (
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition"
            >
              <span className="flex items-center gap-1.5">
                <History size={14} className="text-emerald-400" /> Settled Payments ({payments.length})
              </span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showHistory && (
              <div className="space-y-2">
                {payments.map((p) => {
                  const debtor = getMember(p.payer_id);
                  const creditor = getMember(p.receiver_id);

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.015] border border-white/5 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="text-slate-300">
                          <span className="text-slate-400 font-medium">{debtor?.name}</span> paid{" "}
                          <span className="text-emerald-400 font-medium">{creditor?.name}</span>
                        </div>
                        {p.created_at && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            {new Date(p.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-emerald-400">
                          ₱{p.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1 text-slate-600 hover:text-amber-400 transition"
                          title="Undo payment"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/90 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={openNewExpenseModal}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition text-sm"
          >
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#121824] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus size={18} className="text-emerald-400" /> Add Person to Tab
              </h3>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              New members will immediately be able to join expenses and settle balances.
            </p>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex, Sarah"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  required
                  autoFocus
                  disabled={addingMember}
                  className="w-full mt-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={addingMember}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {addingMember ? <Loader2 size={16} className="animate-spin" /> : "Add to Group"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {inspectingExpense && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#121824] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {inspectingExpense.title || "Expense Breakdown"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paid by <span className="text-emerald-400 font-semibold">{getMember(inspectingExpense.payerMemberId)?.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setInspectingExpense(null)} 
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Total Amount</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                ₱{inspectingExpense.amount.toFixed(2)}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Who Split & How Much
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inspectingExpense.splits.map((s) => (
                  <div 
                    key={s.memberId} 
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.015] border border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">
                        {getMember(s.memberId)?.name}
                      </span>
                      {s.memberId === inspectingExpense.payerMemberId && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                          Payer
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-300">
                      ₱{s.amountOwed.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const exp = inspectingExpense;
                  setInspectingExpense(null);
                  openEditExpenseModal(exp);
                }}
                className="flex-1 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Pencil size={14} /> Edit Expense
              </button>
              <button
                onClick={() => handleDeleteExpense(inspectingExpense.id)}
                className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#121824] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Your Settlement Info</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              When someone owes you money, they will send payment to this account.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Payment Method</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full mt-1 bg-[#1A2234] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                >
                  <option value="GCash">GCash</option>
                  <option value="Maya">Maya</option>
                  <option value="QR Ph">QR Ph</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Account / Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. 09171234567"
                  value={editAccountNumber}
                  onChange={(e) => setEditAccountNumber(e.target.value)}
                  required
                  className="w-full mt-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm transition"
              >
                {savingProfile ? "Saving..." : "Save Payment Details"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {activeSettlement && (() => {
        const creditor = getMember(activeSettlement.creditorId);
        const debtor = getMember(activeSettlement.debtorId);
        const hasPaymentDetails = Boolean(creditor?.account_number);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-5">
            <div className="w-full max-w-sm bg-[#121824] border border-white/10 rounded-3xl p-6 text-center space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Settlement Transfer</span>
                <button onClick={() => setActiveSettlement(null)} className="text-slate-400 p-1">
                  <X size={20} />
                </button>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  <span className="text-rose-400 font-semibold">{debtor?.name}</span> pays <span className="text-emerald-400 font-semibold">{creditor?.name}</span>
                </p>
                <p className="text-3xl font-black font-mono text-white mt-1">
                  ₱{activeSettlement.amount.toFixed(2)}
                </p>
              </div>

              {hasPaymentDetails ? (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{creditor?.payment_method || "E-Wallet"}</span>
                    <Smartphone size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white font-semibold text-base">
                      {creditor?.account_number}
                    </span>
                    <button
                      onClick={() => copyToClipboard(creditor?.account_number || "")}
                      className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg hover:bg-emerald-500/20 flex items-center gap-1"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  {creditor?.name} has not added their GCash/Maya number yet.
                </div>
              )}

              <div className="bg-white p-3 rounded-2xl w-fit mx-auto shadow-inner">
                <QRCodeSVG
                  value={
                    hasPaymentDetails
                      ? `${creditor?.payment_method?.toLowerCase()}://${creditor?.account_number}?amount=${activeSettlement.amount}`
                      : `evenly://pay?recipient=${encodeURIComponent(creditor?.name || "")}&amount=${activeSettlement.amount}`
                  }
                  size={140}
                  level="M"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleConfirmSettlement(activeSettlement)}
                  disabled={settling}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  {settling ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Mark as Paid
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveSettlement(null)}
                  className="w-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 font-semibold py-2.5 rounded-xl text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add/Edit Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#121824] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">
                {editingExpenseId ? "Edit Expense" : "Log an Expense"}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Expense Title</label>
                <input
                  type="text"
                  placeholder="e.g. Samgyup, Grab, Drinks"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={submittingExpense}
                  className="w-full mt-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Total Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={submittingExpense}
                  className="w-full mt-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-base focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Who Paid?</label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="w-full mt-1 bg-[#1A2234] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Split Mode Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Split Method</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/10 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSplitMode("equal")}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${
                      splitMode === "equal"
                        ? "bg-emerald-500 text-black shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("exact")}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${
                      splitMode === "exact"
                        ? "bg-emerald-500 text-black shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Exact Amounts
                  </button>
                </div>
              </div>

              {/* Dynamic Split Input Area */}
              {splitMode === "equal" ? (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Split Between</label>
                  <div className="grid grid-cols-2 gap-2">
                    {members.map((m) => {
                      const isChecked = selectedMembers.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            if (isChecked) {
                              if (selectedMembers.length > 1) {
                                setSelectedMembers(selectedMembers.filter((id) => id !== m.id));
                              }
                            } else {
                              setSelectedMembers([...selectedMembers, m.id]);
                            }
                          }}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                            isChecked
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                              : "bg-white/[0.02] border-white/5 text-slate-400"
                          }`}
                        >
                          {m.name}
                          {isChecked && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400 uppercase">Custom Amounts</span>
                    <span
                      className={`font-mono font-medium ${
                        Math.abs(totalExactAllocated - (parseFloat(amount) || 0)) < 0.01
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      ₱{totalExactAllocated.toFixed(2)} / ₱{(parseFloat(amount) || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-2.5 rounded-xl">
                        <span className="text-xs font-medium text-slate-300">{m.name}</span>
                        <div className="flex items-center gap-1.5 w-32">
                          <span className="text-xs text-slate-500">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={exactSplits[m.id] ?? ""}
                            onChange={(e) =>
                              setExactSplits({
                                ...exactSplits,
                                [m.id]: e.target.value,
                              })
                            }
                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1.5 text-right font-mono text-xs text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {Math.abs(totalExactAllocated - (parseFloat(amount) || 0)) > 0.05 && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1">
                      <AlertCircle size={12} /> Sum does not match total expense.
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingExpense}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm mt-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingExpense ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  editingExpenseId ? "Update Expense" : "Save Expense"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}