"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { computeSettlements, Member, Expense, Settlement, PaymentRecord } from "@/lib/algorithm";
import { 
  ArrowLeft, Plus, QrCode, Check, 
  Receipt, Share2, X, Loader2,
  Copy, Edit3, Smartphone, CheckCircle2, Trash2, Pencil,
  History, ChevronDown, ChevronUp, RotateCcw, AlertCircle,
  UserPlus, Users, Upload
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

interface TabRecord {
  id: string;
  slug: string;
  title: string;
}

interface FullMember extends Member {
  payment_method?: string;
  account_number?: string;
  qr_image_url?: string;
}

interface DetailedExpense extends Expense {
  title?: string;
}

interface DetailedPayment extends PaymentRecord {
  id?: string;
  created_at?: string;
}

export default function TabPage() {
  const router = useRouter();
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
  
  // Member Management State
  const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [isDeletingTab, setIsDeletingTab] = useState(false);

  const [showHistory, setShowHistory] = useState(true);
  const [activeSettlement, setActiveSettlement] = useState<Settlement | null>(null);
  const [copied, setCopied] = useState(false);
  const [settling, setSettling] = useState(false);

  // Payment profile state
  const [editPaymentMethod, setEditPaymentMethod] = useState("GCash");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editQrFile, setEditQrFile] = useState<File | null>(null);
  const [editQrPreview, setEditQrPreview] = useState<string | null>(null);
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
        .select("id, name, payment_method, account_number, qr_image_url")
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
      setEditQrPreview(target.qr_image_url || null);
      setEditQrFile(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMemberId || savingProfile) return;

    if (!editAccountNumber.trim() && !editQrFile && !editQrPreview) {
      alert("Please provide either your account number or upload a QR code image.");
      return;
    }

    setSavingProfile(true);
    try {
      let qrImageUrl = editQrPreview;

      if (editQrFile) {
        const fileExt = editQrFile.name.split(".").pop();
        const randomStr = Math.random().toString(36).substring(2);
        const fileName = `${currentMemberId}-${randomStr}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("qr-codes")
          .upload(filePath, editQrFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("qr-codes")
          .getPublicUrl(filePath);

        qrImageUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase
        .from("tab_members")
        .update({
          payment_method: editPaymentMethod,
          account_number: editAccountNumber.trim(),
          qr_image_url: qrImageUrl,
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
      await fetchTabData();
    } catch (err: any) {
      alert(err.message || "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const settlements = computeSettlements(members, expenses, payments);

  const getMemberNetBalance = (memberId: string): number => {
    let owedToMember = 0;
    let memberOwes = 0;

    settlements.forEach((s) => {
      if (s.creditorId === memberId) owedToMember += s.amount;
      if (s.debtorId === memberId) memberOwes += s.amount;
    });

    return Math.round((owedToMember - memberOwes) * 100) / 100;
  };

  const handleDeleteMember = async (member: FullMember) => {
    if (!tab) return;

    if (members.length <= 2) {
      alert("A tab must have at least 2 members.");
      return;
    }

    const net = getMemberNetBalance(member.id);

    if (Math.abs(net) > 0.01) {
      if (net > 0) {
        alert(`Cannot remove ${member.name}. They are still owed ₱${net.toFixed(2)}. Settle all payments first.`);
      } else {
        alert(`Cannot remove ${member.name}. They still owe ₱${Math.abs(net).toFixed(2)}. Settle all payments first.`);
      }
      return;
    }

    const isPayerInAny = expenses.some((e) => e.payerMemberId === member.id && e.amount > 0);
    if (isPayerInAny) {
      alert(`Cannot remove ${member.name}. They are recorded as the payer for existing expenses.`);
      return;
    }

    if (!confirm(`Are you sure you want to remove ${member.name}? Their balance is completely settled.`)) {
      return;
    }

    setDeletingMemberId(member.id);
    try {
      await supabase.from("expense_splits").delete().eq("member_id", member.id);

      const { error } = await supabase.from("tab_members").delete().eq("id", member.id);
      if (error) throw error;

      if (currentMemberId === member.id) {
        setCurrentMemberId(null);
        localStorage.removeItem(`user_${slug}`);
      }

      await fetchTabData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to remove member");
    } finally {
      setDeletingMemberId(null);
    }
  };

  const handleDeleteTab = async () => {
    if (!tab || isDeletingTab) return;

    const confirmation = confirm(
      `Are you sure you want to permanently delete "${tab.title}"?\n\nThis will remove all expenses, split calculations, and settlement logs for all group members. This action cannot be undone.`
    );
    if (!confirmation) return;

    setIsDeletingTab(true);
    try {
      const { error } = await supabase.from("tabs").delete().eq("id", tab.id);
      if (error) throw error;

      try {
        const existing = JSON.parse(localStorage.getItem("evenly_recent_tabs") || "[]");
        const filtered = existing.filter((item: { slug: string }) => item.slug !== tab.slug);
        localStorage.setItem("evenly_recent_tabs", JSON.stringify(filtered));
        localStorage.removeItem(`user_${slug}`);
      } catch (err) {
        console.error("Failed to clean up localStorage:", err);
      }

      router.push("/");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to delete tab");
      setIsDeletingTab(false);
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
      <div className="min-h-screen flex items-center justify-center text-slate-500 dark:text-slate-400 gap-2">
        <Loader2 size={20} className="animate-spin text-emerald-500" />
        <span className="animate-pulse">Loading Tab...</span>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-3 p-6 text-center animate-fade-in">
        <p className="text-slate-900 dark:text-white font-semibold">Tab not found</p>
        <p className="text-sm">
          {fetchError ? `Error: ${fetchError}` : `No tab found matching slug "${slug}".`}
        </p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-semibold text-sm active:scale-95 transition">
          Return Home
        </Link>
      </div>
    );
  }

  const getMember = (id: string) => members.find((m) => m.id === id);

  return (
    <main className="min-h-screen max-w-md mx-auto pb-28 relative">
      <header className="sticky top-0 z-20 bg-slate-50/80 dark:bg-[#0B0F17]/80 backdrop-blur-md px-5 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-xl bg-black/5 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white active:scale-95 transition">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-bold text-base text-slate-900 dark:text-white leading-tight">{tab.title}</h1>
            <button 
              onClick={() => setIsManageMembersModalOpen(true)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-500 flex items-center gap-1 transition"
            >
              <span>{members.length} members</span>
              <span className="text-[10px] text-emerald-500 font-medium">· Manage</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Invite link copied to clipboard!");
            }}
            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition"
            title="Share tab link"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={handleDeleteTab}
            disabled={isDeletingTab}
            className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 active:scale-95 transition"
            title="Delete this tab"
          >
            {isDeletingTab ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
      </header>

      {/* Identity Selector & Add Member Button */}
      <section className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 pr-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 font-medium">You:</span>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => handleClaimIdentity(m.id)}
              className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all duration-200 active:scale-95 ${
                currentMemberId === m.id
                  ? "bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20"
                  : "bg-black/5 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/10 dark:hover:bg-white/[0.08]"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsManageMembersModalOpen(true)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-black/5 dark:hover:bg-white/[0.04] active:scale-90 transition"
            title="Manage tab members"
          >
            <Users size={16} />
          </button>

          {currentMemberId && (
            <button
              onClick={() => {
                const current = getMember(currentMemberId);
                if (current) {
                  setEditPaymentMethod(current.payment_method || "GCash");
                  setEditAccountNumber(current.account_number || "");
                  setEditQrPreview(current.qr_image_url || null);
                  setEditQrFile(null);
                }
                setIsProfileModalOpen(true);
              }}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-black/5 dark:hover:bg-white/[0.04] active:scale-90 transition"
              title="Edit payment info"
            >
              <Edit3 size={15} />
            </button>
          )}
        </div>
      </section>

      <div className="p-5 space-y-6">
        {/* Settlements */}
        <section className="bg-white dark:bg-white/[0.03] border border-black/5 dark:border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-sm dark:shadow-lg animate-fade-in transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Image src="/icon.svg" alt="Evenly" width={16} height={16} className="rounded-sm" /> Suggested Settle Up
            </h2>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-mono">
              {settlements.length} left
            </span>
          </div>

          {settlements.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400 animate-fade-in">
              🎉 Everyone is fully settled up!
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s, idx) => {
                const creditor = getMember(s.creditorId);
                const debtor = getMember(s.debtorId);

                return (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:border-emerald-500/30 transition duration-200">
                    <div className="text-sm">
                      <span className="font-semibold text-rose-500 dark:text-rose-400">{debtor?.name}</span>
                      <span className="text-slate-400 dark:text-slate-500 mx-1.5">&rarr;</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{creditor?.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">₱{s.amount.toFixed(2)}</span>
                      <button
                        onClick={() => {
                          setActiveSettlement(s);
                          setCopied(false);
                        }}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1 active:scale-95 transition"
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Receipt size={14} className="text-emerald-500 dark:text-emerald-400" /> Logged Expenses
          </h2>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500 animate-fade-in">
              No expenses recorded yet. Tap below to add one.
            </div>
          ) : (
            expenses.map((exp) => (
              <div 
                key={exp.id} 
                onClick={() => setInspectingExpense(exp)}
                className="p-4 rounded-xl bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2 cursor-pointer hover:border-black/10 dark:hover:border-white/10 active:scale-[0.99] transition duration-200 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{exp.title || "Expense"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{getMember(exp.payerMemberId)?.name}</span> paid · {exp.splits.length} split
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₱{exp.amount.toFixed(2)}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditExpenseModal(exp)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg active:scale-90 transition"
                        title="Edit expense"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg active:scale-90 transition"
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
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              <span className="flex items-center gap-1.5">
                <History size={14} className="text-emerald-500 dark:text-emerald-400" /> Settled Payments ({payments.length})
              </span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showHistory && (
              <div className="space-y-2 animate-fade-in">
                {payments.map((p) => {
                  const debtor = getMember(p.payer_id);
                  const creditor = getMember(p.receiver_id);

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-white/[0.015] border border-black/5 dark:border-white/5 text-xs hover:border-black/10 dark:hover:border-white/10 transition"
                    >
                      <div className="space-y-0.5">
                        <div className="text-slate-700 dark:text-slate-300">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">{debtor?.name}</span> paid{" "}
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{creditor?.name}</span>
                        </div>
                        {p.created_at && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
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
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          ₱{p.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1 text-slate-400 hover:text-amber-500 active:scale-90 transition"
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50/90 dark:from-[#0B0F17] dark:via-[#0B0F17]/90 to-transparent z-10 pointer-events-none transition-colors">
        <div className="max-w-md mx-auto pointer-events-auto">
          <button
            onClick={openNewExpenseModal}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition text-sm"
          >
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Manage Members Modal */}
      {isManageMembersModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121824] border-t sm:border border-black/10 dark:border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-5 animate-sheet-up shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-emerald-500 dark:text-emerald-400" /> Manage Group Members
              </h3>
              <button onClick={() => setIsManageMembersModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>

            {/* Quick Add Input */}
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                placeholder="Add member name..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                required
                disabled={addingMember}
                className="flex-1 bg-slate-100 dark:bg-white/[0.05] border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs focus:border-emerald-500 outline-none transition"
              />
              <button
                type="submit"
                disabled={addingMember}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
              >
                {addingMember ? <Loader2 size={14} className="animate-spin" /> : <><UserPlus size={14} /> Add</>}
              </button>
            </form>

            {/* Current Members List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {members.map((m) => {
                const net = getMemberNetBalance(m.id);
                const isDeleting = deletingMemberId === m.id;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {m.name}
                        {currentMemberId === m.id && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                            You
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[11px]">
                        {net > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Is owed ₱{net.toFixed(2)}</span>
                        ) : net < 0 ? (
                          <span className="text-rose-500 dark:text-rose-400 font-medium">Owes ₱{Math.abs(net).toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">Balance: ₱0.00 (Settled)</span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteMember(m)}
                      disabled={isDeleting}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-lg active:scale-90 transition disabled:opacity-40"
                      title={Math.abs(net) > 0.01 ? "Cannot delete while balance is unsettled" : "Remove member"}
                    >
                      {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                );
              })}
            </div>
            
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              * Members can only be removed when their net balance is completely settled (₱0.00) and tabs must keep at least 2 members.
            </p>
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {inspectingExpense && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121824] border-t sm:border border-black/10 dark:border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-5 animate-sheet-up shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {inspectingExpense.title || "Expense Breakdown"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Paid by <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{getMember(inspectingExpense.payerMemberId)?.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setInspectingExpense(null)} 
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 active:scale-90 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Amount</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ₱{inspectingExpense.amount.toFixed(2)}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                Who Split & How Much
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inspectingExpense.splits.map((s) => (
                  <div 
                    key={s.memberId} 
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.015] border border-black/5 dark:border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {getMember(s.memberId)?.name}
                      </span>
                      {s.memberId === inspectingExpense.payerMemberId && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                          Payer
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <Pencil size={14} /> Edit Expense
              </button>
              <button
                onClick={() => {
                  handleDeleteExpense(inspectingExpense.id);
                }}
                className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-xl active:scale-90 transition"
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
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121824] border-t sm:border border-black/10 dark:border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 animate-sheet-up shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Your Settlement Info</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide your account number or upload a personal QR code so others can pay you easily.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Payment Method</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full mt-1 bg-slate-100 dark:bg-[#1A2234] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition"
                >
                  <option value="GCash">GCash</option>
                  <option value="Maya">Maya</option>
                  <option value="QR Ph">QR Ph</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Account / Mobile Number <span className="text-slate-400 font-normal">(Optional if QR uploaded)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 09171234567"
                  value={editAccountNumber}
                  onChange={(e) => setEditAccountNumber(e.target.value)}
                  className="w-full mt-1 bg-slate-100 dark:bg-white/[0.05] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              {/* QR Code Image Upload */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">
                  Or Upload QR Code Image
                </label>
                <div className="flex items-center gap-3">
                  {editQrPreview && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 shrink-0">
                      <Image src={editQrPreview} alt="QR Preview" fill className="object-cover" />
                    </div>
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer text-xs text-slate-600 dark:text-slate-300 transition">
                    <Upload size={15} />
                    <span>{editQrFile ? editQrFile.name : editQrPreview ? "Change QR Image..." : "Choose QR Image..."}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditQrFile(file);
                          setEditQrPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  {editQrPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditQrFile(null);
                        setEditQrPreview(null);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-500 transition"
                      title="Remove QR image"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm active:scale-95 transition"
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
        const hasCustomQr = Boolean(creditor?.qr_image_url);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-5 animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-[#121824] border border-black/10 dark:border-white/10 rounded-3xl p-6 text-center space-y-4 animate-sheet-up shadow-2xl">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Settlement Transfer</span>
                <button onClick={() => setActiveSettlement(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 active:scale-90 transition">
                  <X size={20} />
                </button>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="text-rose-500 dark:text-rose-400 font-semibold">{debtor?.name}</span> pays <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{creditor?.name}</span>
                </p>
                <p className="text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
                  ₱{activeSettlement.amount.toFixed(2)}
                </p>
              </div>

              {hasPaymentDetails ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{creditor?.payment_method || "E-Wallet"}</span>
                    <Smartphone size={14} className="text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-900 dark:text-white font-semibold text-base">
                      {creditor?.account_number}
                    </span>
                    <button
                      onClick={() => copyToClipboard(creditor?.account_number || "")}
                      className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg hover:bg-emerald-500/20 flex items-center gap-1 active:scale-95 transition"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ) : !hasCustomQr ? (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-300">
                  {creditor?.name} has not added their payment info yet.
                </div>
              ) : null}

              {/* Display Custom Uploaded QR or Fallback to Generated QR */}
              {(hasCustomQr || hasPaymentDetails) && (
                <div className="bg-white p-3 rounded-2xl w-fit mx-auto shadow-inner border border-black/5">
                  {hasCustomQr ? (
                    <div className="relative w-40 h-40 rounded-xl overflow-hidden">
                      <Image src={creditor!.qr_image_url!} alt="Custom QR" fill className="object-contain" />
                    </div>
                  ) : (
                    <QRCodeSVG
                      value={
                        hasPaymentDetails && creditor
                          ? `${creditor.payment_method?.toLowerCase()}://${creditor.account_number}?amount=${activeSettlement.amount}`
                          : `evenly://pay?recipient=${encodeURIComponent(creditor?.name || "")}&amount=${activeSettlement.amount}`
                      }
                      size={140}
                      level="M"
                    />
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleConfirmSettlement(activeSettlement)}
                  disabled={settling}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50"
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
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 font-semibold py-2.5 rounded-xl text-xs active:scale-95 transition"
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
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121824] border-t sm:border border-black/10 dark:border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-sheet-up shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingExpenseId ? "Edit Expense" : "Log an Expense"}
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 active:scale-90 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Expense Title</label>
                <input
                  type="text"
                  placeholder="e.g. Samgyup, Grab, Drinks"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={submittingExpense}
                  className="w-full mt-1 bg-slate-100 dark:bg-white/[0.05] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Amount (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={submittingExpense}
                  className="w-full mt-1 bg-slate-100 dark:bg-white/[0.05] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono text-base focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Who Paid?</label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="w-full mt-1 bg-slate-100 dark:bg-[#1A2234] border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm focus:border-emerald-500 outline-none transition"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Split Mode Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Split Method</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSplitMode("equal")}
                    className={`py-2 rounded-lg text-xs font-semibold transition active:scale-95 ${
                      splitMode === "equal"
                        ? "bg-emerald-500 text-black shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("exact")}
                    className={`py-2 rounded-lg text-xs font-semibold transition active:scale-95 ${
                      splitMode === "exact"
                        ? "bg-emerald-500 text-black shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Exact Amounts
                  </button>
                </div>
              </div>

              {/* Dynamic Split Input Area */}
              {splitMode === "equal" ? (
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 block">Split Between</label>
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
                          className={`px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between active:scale-95 transition ${
                            isChecked
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-100 dark:bg-white/[0.02] border-black/5 dark:border-white/5 text-slate-600 dark:text-slate-400"
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
                    <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase">Custom Amounts</span>
                    <span
                      className={`font-mono font-medium ${
                        Math.abs(totalExactAllocated - (parseFloat(amount) || 0)) < 0.01
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500 dark:text-rose-400"
                      }`}
                    >
                      ₱{totalExactAllocated.toFixed(2)} / ₱{(parseFloat(amount) || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 p-2.5 rounded-xl">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-300">{m.name}</span>
                        <div className="flex items-center gap-1.5 w-32">
                          <span className="text-xs text-slate-400">₱</span>
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
                            className="w-full bg-white dark:bg-white/[0.05] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-right font-mono text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {Math.abs(totalExactAllocated - (parseFloat(amount) || 0)) > 0.05 && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 flex items-center gap-1 animate-fade-in">
                      <AlertCircle size={12} /> Sum does not match total expense.
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingExpense}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm mt-2 transition shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
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