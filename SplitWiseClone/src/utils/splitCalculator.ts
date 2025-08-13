import { Balance, User } from '../types';

export interface SplitCalculation {
  user_id: string;
  amount: number;
}

export interface SettlementSuggestion {
  from_user_id: string;
  to_user_id: string;
  amount: number;
}

export class SplitCalculator {
  static calculateEqualSplit(totalAmount: number, userIds: string[]): SplitCalculation[] {
    const splitAmount = Math.round((totalAmount / userIds.length) * 100) / 100;
    const remainder = Math.round((totalAmount - splitAmount * userIds.length) * 100) / 100;
    
    return userIds.map((userId, index) => ({
      user_id: userId,
      amount: index === 0 ? splitAmount + remainder : splitAmount
    }));
  }

  static calculateExactSplit(splits: { [userId: string]: number }): SplitCalculation[] {
    return Object.entries(splits).map(([userId, amount]) => ({
      user_id: userId,
      amount: Math.round(amount * 100) / 100
    }));
  }

  static calculatePercentageSplit(
    totalAmount: number, 
    percentages: { [userId: string]: number }
  ): SplitCalculation[] {
    const totalPercentage = Object.values(percentages).reduce((sum, pct) => sum + pct, 0);
    
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error('Percentages must sum to 100%');
    }

    return Object.entries(percentages).map(([userId, percentage]) => ({
      user_id: userId,
      amount: Math.round((totalAmount * percentage / 100) * 100) / 100
    }));
  }

  static validateSplit(totalAmount: number, splits: SplitCalculation[]): boolean {
    const sumSplits = splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(sumSplits - totalAmount) < 0.01;
  }

  static calculateOptimalSettlements(balances: Balance[]): SettlementSuggestion[] {
    const settlements: SettlementSuggestion[] = [];
    
    const creditors = balances
      .filter(balance => balance.balance > 0.01)
      .map(balance => ({ ...balance }))
      .sort((a, b) => b.balance - a.balance);
    
    const debtors = balances
      .filter(balance => balance.balance < -0.01)
      .map(balance => ({ ...balance, balance: -balance.balance }))
      .sort((a, b) => b.balance - a.balance);

    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];

      const settlementAmount = Math.min(creditor.balance, debtor.balance);
      
      if (settlementAmount > 0.01) {
        settlements.push({
          from_user_id: debtor.user_id,
          to_user_id: creditor.user_id,
          amount: Math.round(settlementAmount * 100) / 100
        });

        creditor.balance -= settlementAmount;
        debtor.balance -= settlementAmount;
      }

      if (creditor.balance < 0.01) {
        creditorIndex++;
      }
      if (debtor.balance < 0.01) {
        debtorIndex++;
      }
    }

    return settlements;
  }

  static calculateUserBalance(
    userId: string,
    expenses: Array<{
      id: string;
      amount: number;
      paid_by: string;
      splits?: Array<{ user_id: string; amount: number; }>;
    }>
  ): number {
    let balance = 0;

    expenses.forEach(expense => {
      if (expense.paid_by === userId) {
        balance += expense.amount;
      }

      if (expense.splits) {
        const userSplit = expense.splits.find(split => split.user_id === userId);
        if (userSplit) {
          balance -= userSplit.amount;
        }
      }
    });

    return Math.round(balance * 100) / 100;
  }

  static calculateGroupTotalBalance(balances: Balance[]): number {
    return balances.reduce((total, balance) => total + Math.abs(balance.balance), 0);
  }

  static formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  static getBalanceColor(balance: number): string {
    if (balance > 0.01) return '#4CAF50'; // Green for positive
    if (balance < -0.01) return '#F44336'; // Red for negative
    return '#757575'; // Gray for zero
  }

  static getBalanceStatus(balance: number): 'owes' | 'owed' | 'settled' {
    if (balance > 0.01) return 'owed';
    if (balance < -0.01) return 'owes';
    return 'settled';
  }

  static simplifyDebts(balances: Balance[]): SettlementSuggestion[] {
    const nonZeroBalances = balances.filter(b => Math.abs(b.balance) > 0.01);
    
    if (nonZeroBalances.length <= 2) {
      return this.calculateOptimalSettlements(balances);
    }

    const graph = this.buildDebtGraph(nonZeroBalances);
    return this.minimizeTransactions(graph);
  }

  private static buildDebtGraph(balances: Balance[]): Map<string, Map<string, number>> {
    const graph = new Map();
    
    balances.forEach(balance => {
      graph.set(balance.user_id, new Map());
    });

    return graph;
  }

  private static minimizeTransactions(graph: Map<string, Map<string, number>>): SettlementSuggestion[] {
    return this.calculateOptimalSettlements([]);
  }
}