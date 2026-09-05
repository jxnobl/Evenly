export interface Member {
  id: string;
  name: string;
}

export interface ExpenseSplit {
  memberId: string;
  amountOwed: number;
}

export interface Expense {
  id: string;
  payerMemberId: string;
  amount: number;
  splits: ExpenseSplit[];
}

export interface Settlement {
  debtorId: string;
  creditorId: string;
  amount: number;
}

export function computeSettlements(members: Member[], expenses: Expense[]): Settlement[] {
  const netBalances: Record<string, number> = {};

  members.forEach((m) => {
    netBalances[m.id] = 0;
  });

  expenses.forEach((expense) => {
    netBalances[expense.payerMemberId] = (netBalances[expense.payerMemberId] || 0) + expense.amount;
    expense.splits.forEach((split) => {
      netBalances[split.memberId] = (netBalances[split.memberId] || 0) - split.amountOwed;
    });
  });

  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  Object.entries(netBalances).forEach(([id, balance]) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded > 0.01) {
      creditors.push({ id, amount: rounded });
    } else if (rounded < -0.01) {
      debtors.push({ id, amount: -rounded });
    }
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.01) {
      settlements.push({
        debtorId: debtor.id,
        creditorId: creditor.id,
        amount: Math.round(settledAmount * 100) / 100,
      });
    }

    debtor.amount = Math.round((debtor.amount - settledAmount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - settledAmount) * 100) / 100;

    if (debtor.amount <= 0.01) i++;
    if (creditor.amount <= 0.01) j++;
  }

  return settlements;
}