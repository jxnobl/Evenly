"use client";

import { useEffect, useState, use } from "react";
import { computeSettlements, Member, Expense, Settlement } from "@/lib/algorithm";
import { 
  ArrowLeft, Plus, QrCode, CheckCircle2, Copy, Check, 
  Receipt, Users, Wallet, Share2, X 
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

interface TabData {
  slug: string;
  title: string;
  members: Member[];
  expenses: Expense[];
}

export default function TabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tab, setTab] = useState<TabData | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeSettlement, setActiveSettlement] = useState<Settlement | null>(null);
  const [copied, setCopied] = useState(false);

  // New expense form state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`tab_${slug}`);
    if (saved) {
      const data: TabData = JSON.parse(saved);
      setTab(data);
      if (data.members.length > 0) {
        setPayerId(data.members[0].id);
        setSelectedMembers(data.members.map((m) => m.id));
      }
    }
    const savedUser = localStorage.getItem(`user_${slug}`);
    if (savedUser) setCurrentMemberId(savedUser);
  }, [slug]);

  const saveTab = (updated: TabData) => {
    setTab(updated);
    localStorage.setItem(`tab_${slug}`, JSON.stringify(updated));
  };

  const handleClaimIdentity = (id: string) => {
    setCurrentMemberId(id);
    localStorage.setItem(`user_${slug}`, id);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tab || !title.trim() || !amount || selectedMembers.length === 0) return;

    const total = parseFloat(amount);
    const splitAmount = Math.round((total / selectedMembers.length) * 100) / 100;

    const newExpense: Expense = {
      id: "exp_" + Date.now(),
      payerMemberId: payerId,
      amount: total,
      splits: selectedMembers.map((mId) => ({
        memberId: mId,
        amountOwed: splitAmount,
      })),
    };

    const updated = {
      ...tab,
      expenses: [newExpense, ...tab.expenses],
    };

    saveTab(updated);
    setTitle("");
    setAmount("");
    setIsExpenseModalOpen(false);
  };

  if (!tab) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center text-slate-400">
        Loading Tab...
      </div>
    );
  }

  const settlements = computeSettlements(tab.members, tab.expenses);
  const getMemberName = (id: string) => tab.members.find((m) => m.id === id)?.name || "Unknown";

  return (
    <main className="min-h-screen bg-[#0B0F17] text-slate-100 max-w-md mx-auto pb-24 relative">
      {/* Top App Header */}
      <header className="sticky top-0 z-20 bg-[#0B0F17]/80 backdrop-blur-md px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-xl bg-white/[0.03] text-slate-400 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-bold text-base text-white leading-tight">{tab.title}</h1>
            <p className="text-xs text-slate-500">{tab.members.length} members</p>
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

      {/* Identity Selector Pill */}
      <section className="px-5 py-3 bg-white/[0.02] border-b border-white/5 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-slate-500 shrink-0 font-medium">Viewing as:</span>
        {tab.members.map((m) => (
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
      </section>

      <div className="p-5 space-y-6">
        {/* Settlement Summary Card */}
        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wallet size={14} className="text-emerald-400" /> Suggested Settle Up
            </h2>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-mono">
              {settlements.length} transfers
            </span>
          </div>

          {settlements.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              🎉 Everyone is fully settled up!
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-sm">
                    <span className="font-semibold text-rose-400">{getMemberName(s.debtorId)}</span>
                    <span className="text-slate-500 mx-1.5">&rarr;</span>
                    <span className="font-semibold text-emerald-400">{getMemberName(s.creditorId)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white text-sm">₱{s.amount.toFixed(2)}</span>
                    <button
                      onClick={() => setActiveSettlement(s)}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <QrCode size={13} /> Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Expenses Feed */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Receipt size={14} className="text-emerald-400" /> Recent Expenses
          </h2>
          {tab.expenses.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-600">
              No expenses added yet. Tap the button below to add one.
            </div>
          ) : (
            tab.expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">{exp.payerMemberId ? getMemberName(exp.payerMemberId) : "Someone"} paid for</p>
                  <p className="text-xs text-slate-400">{exp.splits.length} people split</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-emerald-400">₱{exp.amount.toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/90 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition"
          >
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Add Expense Bottom Sheet Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                  placeholder="e.g. Dinner Bill, Grab Ride"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
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
                  {tab.members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Split Between</label>
                <div className="grid grid-cols-2 gap-2">
                  {tab.members.map((m) => {
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
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm mt-2 transition shadow-lg shadow-emerald-500/20"
              >
                Save Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR Settlement Modal */}
      {activeSettlement && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-sm bg-[#121824] border border-white/10 rounded-3xl p-6 text-center space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Settlement QR</span>
              <button onClick={() => setActiveSettlement(null)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400">Paying recipient</p>
              <h4 className="text-lg font-bold text-white">{getMemberName(activeSettlement.creditorId)}</h4>
              <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
                ₱{activeSettlement.amount.toFixed(2)}
              </p>
            </div>

            {/* Dynamic QR Output */}
            <div className="bg-white p-4 rounded-2xl w-fit mx-auto shadow-inner">
              <QRCodeSVG
                value={`evenly://pay?recipient=${encodeURIComponent(getMemberName(activeSettlement.creditorId))}&amount=${activeSettlement.amount}`}
                size={180}
                level="M"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setActiveSettlement(null);
                  alert("Marked as paid!");
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-sm transition"
              >
                Mark as Settled
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}