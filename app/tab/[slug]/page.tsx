"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { computeSettlements, Member, Expense, Settlement, PaymentRecord } from "@/lib/algorithm";
import { 
  ArrowLeft, Plus, QrCode, Check, 
  Receipt, Wallet, Share2, X, Loader2,
  Copy, Edit3, Smartphone, CheckCircle2, Trash2, Pencil,
  History, ChevronDown, ChevronUp, RotateCcw, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { SpotlightCard } from "@/components/ui/spotlight-card";

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
      <div className="min-h-screen bg-[#050506] flex items-center justify-center text-[#8A8F98] gap-2">
        <Loader2 size={18} className="animate-spin text-[#5E6AD2]" />
        <span className="text-xs font-mono">Synchronizing state...</span>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="min-h-screen bg-[#050506] flex flex-col items-center justify-center text-[#8A8F98] gap-3 p-6 text-center">
        <p className="text-white font-semibold">Tab not found</p>
        <p className="text-xs text-[#8A8F98] font-mono">
          {fetchError ? `Error: ${fetchError}` : `No tab found matching slug "${slug}".`}
        </p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-[#5E6AD2] text-white font-semibold text-xs shadow-linear-cta">
          Return Home
        </Link>
      </div>
    );
  }

  const settlements = computeSettlements(members, expenses, payments);
  const getMember = (id: string) => members.find((m) => m.id === id);

  return (
    <main className="min-h-screen max-w-lg mx-auto pb-32 relative text-[#EDEDEF]">
      {/* Linear Sticky Header */}
      <header className="sticky top-0 z-20 bg-[#050506]/85 backdrop-blur-xl px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between linear-border-top">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-lg text-[#8A8F98] hover:text-white hover:bg-white/[0.04] transition">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-semibold text-sm text-white leading-tight tracking-tight">{tab.title}</h1>
            <p className="text-[11px] font-mono text-[#8A8F98]">{members.length} members connected</p>
          </div>
        </div>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert("Invite link copied to clipboard!");
          }}
          className="p-2 rounded-lg bg-white/[0.03] text-[#8A8F98] hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 transition border border-white/[0.04]"
        >
          <Share2 size={16} />
        </button>
      </header>

      {/* Identity Bar */}
      <section className="px-5 py-2.5 bg-white/[0.015] border-b border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-mono text-[#8A8F98] shrink-0 uppercase tracking-wider">You:</span>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => handleClaimIdentity(m.id)}
              className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition duration-200 ${
                currentMemberId === m.id
                  ? "bg-[#5E6AD2] text-white font-medium shadow-linear-cta"
                  : "bg-white/[0.03] text-[#8A8F98] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

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
            className="p-1.5 ml-2 text-[#8A8F98] hover:text-[#5E6AD2] shrink-0 transition"
            title="Edit payment info"
          >
            <Edit3 size={14} />
          </button>
        )}
      </section>

      <div className="p-5 space-y-6">
        {/* Suggested Settle Up */}
        <SpotlightCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] flex items-center gap-2">
              <Wallet size={13} className="text-[#6872D9]" /> Optimal Settlement Route
            </h2>
            <span className="text-[11px] font-mono text-[#6872D9] bg-[#5E6AD2]/10 border border-[#5E6AD2]/20 px-2 py-0.5 rounded-full">
              {settlements.length} remaining
            </span>
          </div>

          {settlements.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#8A8F98] font-mono">
              ✦ Everyone is fully balanced
            </div>
          ) : (
            <div className="space-y-2.5">
              {settlements.map((s, idx) => {
                const creditor = getMember(s.creditorId);
                const debtor = getMember(s.debtorId);

                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition">
                    <div className="text-xs">
                      <span className="font-medium text-rose-300">{debtor?.name}</span>
                      <span className="text-[#8A8F98] mx-2 font-mono">&rarr;</span>
                      <span className="font-medium text-[#6872D9]">{creditor?.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-white text-xs">₱{s.amount.toFixed(2)}</span>
                      <button
                        onClick={() => {
                          setActiveSettlement(s);
                          setCopied(false);
                        }}
                        className="px-2.5 py-1 bg-[#5E6AD2]/15 hover:bg-[#5E6AD2]/25 text-[#6872D9] border border-[#5E6AD2]/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <QrCode size={12} /> Settle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SpotlightCard>

        {/* Logged Expenses */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] flex items-center gap-2">
            <Receipt size={13} className="text-[#6872D9]" /> Activity Ledger
          </h2>

          {expenses.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#8A8F98] font-mono border border-dashed border-white/[0.06] rounded-2xl">
              No entries logged. Press "Add Expense" below.
            </div>
          ) : (
            expenses.map((exp) => (
              <div 
                key={exp.id} 
                onClick={() => setInspectingExpense(exp)}
                className="p-4 rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] hover:border-white/[0.12] transition duration-200 cursor-pointer flex items-center justify-between shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-white">{exp.title || "Expense"}</p>
                  <p className="text-xs text-[#8A8F98] mt-0.5 font-mono">
                    <span className="text-[#6872D9]">{getMember(exp.payerMemberId)?.name}</span> paid · {exp.splits.length} split
                  </p>
                </div>
                <div className="text-right flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <p className="font-mono font-semibold text-white text-sm">₱{exp.amount.toFixed(2)}</p>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => openEditExpenseModal(exp)}
                      className="p-1.5 text-[#8A8F98] hover:text-white rounded-lg transition"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-1.5 text-[#8A8F98] hover:text-rose-400 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Settled History */}
        {payments.length > 0 && (
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] hover:text-white transition"
            >
              <span className="flex items-center gap-2">
                <History size={13} className="text-[#6872D9]" /> Settled Log ({payments.length})
              </span>
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showHistory && (
              <div className="space-y-2">
                {payments.map((p) => {
                  const debtor = getMember(p.payer_id);
                  const creditor = getMember(p.receiver_id);

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.015] border border-white/[0.04] text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="text-white">
                          <span className="text-[#8A8F98]">{debtor?.name}</span> paid{" "}
                          <span className="text-[#6872D9] font-medium">{creditor?.name}</span>
                        </div>
                        {p.created_at && (
                          <p className="text-[10px] text-[#8A8F98]/70 font-mono">
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
                        <span className="font-mono font-medium text-white">
                          ₱{p.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1 text-[#8A8F98]/50 hover:text-amber-400 transition"
                          title="Undo payment"
                        >
                          <RotateCcw size={12} />
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

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#050506] via-[#050506]/90 to-transparent pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button
            onClick={openNewExpenseModal}
            className="w-full bg-[#5E6AD2] hover:bg-[#6872D9] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-linear-cta active:scale-[0.98] transition-all duration-200 text-sm"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Expense Detail Drawer */}
      {inspectingExpense && (
        <div className="fixed inset-0 z-50 bg-[#020203]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#0a0a0c] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-semibold text-white leading-tight">
                  {inspectingExpense.title || "Expense Breakdown"}
                </h3>
                <p className="text-xs text-[#8A8F98] mt-0.5 font-mono">
                  Paid by <span className="text-[#6872D9] font-medium">{getMember(inspectingExpense.payerMemberId)?.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setInspectingExpense(null)} 
                className="text-[#8A8F98] hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-mono text-[#8A8F98]">Total Sum</span>
              <span className="text-lg font-mono font-semibold text-white">
                ₱{inspectingExpense.amount.toFixed(2)}
              </span>
            </div>

            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] mb-2">
                Participant Allocations
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {inspectingExpense.splits.map((s) => (
                  <div 
                    key={s.memberId} 
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.015] border border-white/[0.04]"
                  >
                    <span className="text-xs text-[#EDEDEF]">
                      {getMember(s.memberId)?.name}
                    </span>
                    <span className="font-mono text-xs text-[#8A8F98]">
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
                className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition border border-white/[0.06]"
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                onClick={() => handleDeleteExpense(inspectingExpense.id)}
                className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#020203]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#0a0a0c] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white">Payment Destination</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-[#8A8F98] p-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-[#8A8F98] leading-relaxed">
              When others settle debts with you, payments route to this destination.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider">Method</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full mt-1.5 bg-[#121318] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-[#5E6AD2] outline-none"
                >
                  <option value="GCash">GCash</option>
                  <option value="Maya">Maya</option>
                  <option value="QR Ph">QR Ph</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider">Account / Phone Number</label>
                <input
                  type="text"
                  placeholder="09171234567"
                  value={editAccountNumber}
                  onChange={(e) => setEditAccountNumber(e.target.value)}
                  required
                  className="w-full mt-1.5 bg-[#121318] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:border-[#5E6AD2] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-[#5E6AD2] hover:bg-[#6872D9] text-white font-semibold py-3 rounded-xl text-xs transition shadow-linear-cta"
              >
                {savingProfile ? "Updating..." : "Save Route"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settlement QR Modal */}
      {activeSettlement && (() => {
        const creditor = getMember(activeSettlement.creditorId);
        const debtor = getMember(activeSettlement.debtorId);
        const hasDetails = Boolean(creditor?.account_number);

        return (
          <div className="fixed inset-0 z-50 bg-[#020203]/85 backdrop-blur-md flex items-center justify-center p-5">
            <div className="w-full max-w-sm bg-[#0a0a0c] border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-mono text-[#6872D9] uppercase tracking-wider">Settlement Transfer</span>
                <button onClick={() => setActiveSettlement(null)} className="text-[#8A8F98] p-1">
                  <X size={18} />
                </button>
              </div>

              <div>
                <p className="text-xs text-[#8A8F98]">
                  <span className="text-rose-300 font-medium">{debtor?.name}</span> transfers to <span className="text-[#6872D9] font-medium">{creditor?.name}</span>
                </p>
                <p className="text-3xl font-semibold font-mono text-white mt-1">
                  ₱{activeSettlement.amount.toFixed(2)}
                </p>
              </div>

              {hasDetails ? (
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs text-[#8A8F98]">
                    <span>{creditor?.payment_method || "E-Wallet"}</span>
                    <Smartphone size={13} className="text-[#6872D9]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white font-semibold text-sm">
                      {creditor?.account_number}
                    </span>
                    <button
                      onClick={() => copyToClipboard(creditor?.account_number || "")}
                      className="text-[11px] text-[#6872D9] bg-[#5E6AD2]/10 px-2 py-1 rounded-md hover:bg-[#5E6AD2]/20 flex items-center gap-1 transition"
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  {creditor?.name} has not registered a destination account.
                </div>
              )}

              <div className="bg-white p-3 rounded-2xl w-fit mx-auto shadow-inner">
                <QRCodeSVG
                  value={
                    hasDetails
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
                  className="w-full bg-[#5E6AD2] hover:bg-[#6872D9] text-white font-semibold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-linear-cta disabled:opacity-50"
                >
                  {settling ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Confirm Payment
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveSettlement(null)}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] text-[#8A8F98] font-medium py-2 rounded-xl text-xs transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add/Edit Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#020203]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#0a0a0c] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white">
                {editingExpenseId ? "Modify Expense" : "Record Expense"}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-[#8A8F98] p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98]">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Dinner, Grab ride"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={submittingExpense}
                  className="w-full mt-1.5 bg-[#121318] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-[#5E6AD2] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98]">Total Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={submittingExpense}
                  className="w-full mt-1.5 bg-[#121318] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:border-[#5E6AD2] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98]">Paid By</label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="w-full mt-1.5 bg-[#121318] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-[#5E6AD2] outline-none"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] mb-1.5 block">Split Method</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/[0.02] border border-white/10 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSplitMode("equal")}
                    className={`py-1.5 rounded-lg text-xs font-medium transition ${
                      splitMode === "equal"
                        ? "bg-[#5E6AD2] text-white shadow-linear-cta"
                        : "text-[#8A8F98] hover:text-white"
                    }`}
                  >
                    Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("exact")}
                    className={`py-1.5 rounded-lg text-xs font-medium transition ${
                      splitMode === "exact"
                        ? "bg-[#5E6AD2] text-white shadow-linear-cta"
                        : "text-[#8A8F98] hover:text-white"
                    }`}
                  >
                    Exact Shares
                  </button>
                </div>
              </div>

              {splitMode === "equal" ? (
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] mb-1.5 block">Split With</label>
                  <div className="grid grid-cols-2 gap-1.5">
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
                          className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition ${
                            isChecked
                              ? "bg-[#5E6AD2]/15 border-[#5E6AD2]/40 text-white"
                              : "bg-white/[0.015] border-white/5 text-[#8A8F98]"
                          }`}
                        >
                          {m.name}
                          {isChecked && <Check size={12} className="text-[#6872D9]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#8A8F98]">Allocated</span>
                    <span
                      className={
                        Math.abs(totalExactAllocated - (parseFloat(amount) || 0)) < 0.01
                          ? "text-[#6872D9]"
                          : "text-rose-400"
                      }
                    >
                      ₱{totalExactAllocated.toFixed(2)} / ₱{(parseFloat(amount) || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 bg-white/[0.015] border border-white/5 p-2 rounded-lg">
                        <span className="text-xs text-[#EDEDEF]">{m.name}</span>
                        <div className="flex items-center gap-1 w-28">
                          <span className="text-xs text-[#8A8F98] font-mono">₱</span>
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
                            className="w-full bg-[#121318] border border-white/10 rounded-md px-2 py-1 text-right font-mono text-xs text-white outline-none focus:border-[#5E6AD2]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {Math.abs(totalExactAllocated - (parseFloat(amount) || 0)) > 0.05 && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
                      <AlertCircle size={12} /> Shares must equal total amount.
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingExpense}
                className="w-full bg-[#5E6AD2] hover:bg-[#6872D9] text-white font-semibold py-3.5 rounded-xl text-xs mt-2 transition shadow-linear-cta disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingExpense ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  editingExpenseId ? "Update Entry" : "Save Entry"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}