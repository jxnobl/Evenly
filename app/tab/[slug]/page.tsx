"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { computeSettlements, Member, Expense, Settlement, PaymentRecord } from "@/lib/algorithm";
import { 
  ArrowLeft, Plus, QrCode, Check, 
  Receipt, Wallet, Share2, X, Loader2,
  Copy, Edit3, Smartphone, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";

interface TabRecord {
  id: string;
  slug: string;
  title: string;
}

interface FullMember extends Member {
  payment_method?: string;
  account_number?: string;
}

export default function TabPage() {
  const routeParams = useParams();
  const slug = Array.isArray(routeParams?.slug) 
    ? routeParams.slug[0] 
    : (routeParams?.slug as string) || "";

  const [tab, setTab] = useState<TabRecord | null>(null);
  const [members, setMembers] = useState<FullMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeSettlement, setActiveSettlement] = useState<Settlement | null>(null);
  const [copied, setCopied] = useState(false);
  const [settling, setSettling] = useState(false);

  // Profile setup state
  const [editPaymentMethod, setEditPaymentMethod] = useState("GCash");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // New expense form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const fetchTabData = useCallback(async () => {
    if (!slug) return;

    try {
      setFetchError(null);

      // 1. Fetch Tab row
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

      // 2. Fetch Members
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

      // 3. Fetch Expenses & Splits separately to prevent join failure
      const { data: rawExpenses, error: expErr } = await supabase
        .from("expenses")
        .select("id, payer_member_id, amount")
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

      const formattedExpenses: Expense[] = (rawExpenses || []).map((e) => ({
        id: e.id,
        payerMemberId: e.payer_member_id,
        amount: Number(e.amount),
        splits: splitsByExpense[e.id] || [],
      }));

      setExpenses(formattedExpenses);

      // 4. Fetch Payments
      const { data: payData, error: payErr } = await supabase
        .from("payments")
        .select("payer_id, receiver_id, amount")
        .eq("tab_id", tabData.id);

      if (!payErr && payData) {
        setPayments(payData);
      }
    } catch (err: any) {
      console.error("fetchTabData failed:", err);
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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tab || !title.trim() || !amount || selectedMembers.length === 0 || submittingExpense) return;

    setSubmittingExpense(true);
    try {
      const total = parseFloat(amount);
      const splitAmount = Math.round((total / selectedMembers.length) * 100) / 100;

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

      const splitsToInsert = selectedMembers.map((mId) => ({
        expense_id: expData.id,
        member_id: mId,
        amount_owed: splitAmount,
      }));

      const { error: splitError } = await supabase
        .from("expense_splits")
        .insert(splitsToInsert);

      if (splitError) throw splitError;

      setTitle("");
      setAmount("");
      setIsExpenseModalOpen(false);
      await fetchTabData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to log expense");
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
          {fetchError ? `Database error: ${fetchError}` : `No tab exists with slug "${slug}".`}
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

      {/* Identity Selector */}
      <section className="px-5 py-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
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
            className="p-1.5 ml-2 text-slate-400 hover:text-emerald-400 shrink-0"
            title="Edit payment info"
          >
            <Edit3 size={15} />
          </button>
        )}
      </section>

      <div className="p-5 space-y-6">
        {/* Suggested Settlements */}
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
              <div key={exp.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">{getMember(exp.payerMemberId)?.name} paid</p>
                  <p className="text-xs text-slate-500">{exp.splits.length} people split</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-emerald-400">₱{exp.amount.toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/90 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition text-sm"
          >
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Edit Payment Profile Modal */}
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

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#121824] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Log an Expense</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase">Expense Title</label>
                <input
                  type="text"
                  placeholder="e.g. Samgyup, Grab, Coffee"
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
                        className={`px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
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

              <button
                type="submit"
                disabled={submittingExpense}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm mt-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingExpense ? <Loader2 size={16} className="animate-spin" /> : "Save Expense"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}