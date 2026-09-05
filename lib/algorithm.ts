export interface Member {
  id: string;
  name: string;
}

export interface Split {
  memberId: string;
  amountOwed: number;
}

export interface Expense {
  id: string;
  payerMemberId: string;
  amount: number;
  splits: Split[];
}

export interface PaymentRecord {
  payer_id: string;
  receiver_id: string;
  amount: number;
}

export interface Settlement {
  debtorId: string;
  creditorId: string;
  amount: number;
}

export function computeSettlements(
  members: Member[],
  expenses: Expense[],
  payments: PaymentRecord[] = []
): Settlement[] {
  const balances: Record<string, number> = {};

  members.forEach((m) => {
    balances[m.id] = 0;
  });

  expenses.forEach((expense) => {
    balances[expense.payerMemberId] = (balances[expense.payerMemberId] || 0) + expense.amount;
    expense.splits.forEach((split) => {
      balances[split.memberId] = (balances[split.memberId] || 0) - split.amountOwed;
    });
  });

  payments.forEach((p) => {
    balances[p.payer_id] = (balances[p.payer_id] || 0) + Number(p.amount);
    balances[p.receiver_id] = (balances[p.receiver_id] || 0) - Number(p.amount);
  });

  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  Object.entries(balances).forEach(([memberId, net]) => {
    const rounded = Math.round(net * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ id: memberId, amount: -rounded });
    } else if (rounded > 0.01) {
      creditors.push({ id: memberId, amount: rounded });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const transfer = Math.min(debtor.amount, creditor.amount);

    if (transfer > 0.01) {
      settlements.push({
        debtorId: debtor.id,
        creditorId: creditor.id,
        amount: Math.round(transfer * 100) / 100,
      });
    }

    debtor.amount -= transfer;
    creditor.amount -= transfer;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return settlements;
}