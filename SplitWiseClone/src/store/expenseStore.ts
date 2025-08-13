import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, ExpenseSplit, Balance } from '../types';
import { databaseManager } from '../database/schema';

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createExpense: (expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>, splits: Omit<ExpenseSplit, 'id' | 'expense_id' | 'created_at'>[]) => Promise<Expense>;
  getExpenseById: (id: string) => Promise<Expense | null>;
  getGroupExpenses: (groupId: string) => Promise<Expense[]>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getExpenseSplits: (expenseId: string) => Promise<ExpenseSplit[]>;
  calculateGroupBalances: (groupId: string) => Promise<Balance[]>;
  settleExpense: (expenseId: string, userId: string) => Promise<void>;
  clearError: () => void;
}

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set, get) => ({
      expenses: [],
      isLoading: false,
      error: null,

      createExpense: async (expenseData, splits) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const expenseId = databaseManager.generateId();
          const timestamp = new Date().toISOString();
          
          const expense: Expense = {
            id: expenseId,
            ...expenseData,
            created_at: timestamp,
            updated_at: timestamp,
          };

          db.withTransactionSync(() => {
            db.runSync(
              `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, created_at, updated_at, category, receipt_image) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                expense.id,
                expense.group_id,
                expense.description,
                expense.amount,
                expense.currency,
                expense.paid_by,
                expense.created_at,
                expense.updated_at,
                expense.category || null,
                expense.receipt_image || null
              ]
            );

            splits.forEach(split => {
              const splitId = databaseManager.generateId();
              db.runSync(
                `INSERT INTO expense_splits (id, expense_id, user_id, amount, is_settled, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [splitId, expenseId, split.user_id, split.amount, split.is_settled ? 1 : 0, timestamp]
              );
            });

            const currentTotal = db.getFirstSync(
              'SELECT total_spent FROM groups WHERE id = ?',
              [expense.group_id]
            ) as { total_spent: number } | null;

            const newTotal = (currentTotal?.total_spent || 0) + expense.amount;
            db.runSync(
              'UPDATE groups SET total_spent = ?, updated_at = ? WHERE id = ?',
              [newTotal, timestamp, expense.group_id]
            );
          });

          set((state) => ({
            expenses: [...state.expenses, expense],
            isLoading: false,
          }));

          return expense;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create expense',
            isLoading: false 
          });
          throw error;
        }
      },

      getExpenseById: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const result = db.getFirstSync(
            `SELECT e.*, u.name as paid_by_name, u.email as paid_by_email 
             FROM expenses e
             JOIN users u ON e.paid_by = u.id
             WHERE e.id = ?`,
            [id]
          ) as any;

          if (!result) {
            set({ isLoading: false });
            return null;
          }

          const expense: Expense = {
            id: result.id,
            group_id: result.group_id,
            description: result.description,
            amount: result.amount,
            currency: result.currency,
            paid_by: result.paid_by,
            created_at: result.created_at,
            updated_at: result.updated_at,
            category: result.category,
            receipt_image: result.receipt_image,
            paid_by_user: {
              id: result.paid_by,
              name: result.paid_by_name,
              email: result.paid_by_email,
              created_at: '',
              updated_at: ''
            }
          };

          set({ isLoading: false });
          return expense;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load expense',
            isLoading: false 
          });
          throw error;
        }
      },

      getGroupExpenses: async (groupId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const result = db.getAllSync(
            `SELECT e.*, u.name as paid_by_name, u.email as paid_by_email 
             FROM expenses e
             JOIN users u ON e.paid_by = u.id
             WHERE e.group_id = ?
             ORDER BY e.created_at DESC`,
            [groupId]
          ) as any[];

          const expenses: Expense[] = result.map(row => ({
            id: row.id,
            group_id: row.group_id,
            description: row.description,
            amount: row.amount,
            currency: row.currency,
            paid_by: row.paid_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
            category: row.category,
            receipt_image: row.receipt_image,
            paid_by_user: {
              id: row.paid_by,
              name: row.paid_by_name,
              email: row.paid_by_email,
              created_at: '',
              updated_at: ''
            }
          }));

          set({ 
            expenses,
            isLoading: false 
          });

          return expenses;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load expenses',
            isLoading: false 
          });
          throw error;
        }
      },

      updateExpense: async (id: string, updates: Partial<Expense>) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const timestamp = new Date().toISOString();
          
          const updateFields = [];
          const values = [];
          
          if (updates.description) {
            updateFields.push('description = ?');
            values.push(updates.description);
          }
          if (updates.amount !== undefined) {
            updateFields.push('amount = ?');
            values.push(updates.amount);
          }
          if (updates.category !== undefined) {
            updateFields.push('category = ?');
            values.push(updates.category);
          }
          if (updates.receipt_image !== undefined) {
            updateFields.push('receipt_image = ?');
            values.push(updates.receipt_image);
          }
          
          updateFields.push('updated_at = ?');
          values.push(timestamp);
          values.push(id);

          db.runSync(
            `UPDATE expenses SET ${updateFields.join(', ')} WHERE id = ?`,
            values
          );

          set((state) => ({
            expenses: state.expenses.map(expense => 
              expense.id === id 
                ? { ...expense, ...updates, updated_at: timestamp }
                : expense
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update expense',
            isLoading: false 
          });
          throw error;
        }
      },

      deleteExpense: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          
          const expense = db.getFirstSync('SELECT * FROM expenses WHERE id = ?', [id]) as Expense;
          
          if (expense) {
            db.withTransactionSync(() => {
              db.runSync('DELETE FROM expense_splits WHERE expense_id = ?', [id]);
              db.runSync('DELETE FROM expenses WHERE id = ?', [id]);

              const currentTotal = db.getFirstSync(
                'SELECT total_spent FROM groups WHERE id = ?',
                [expense.group_id]
              ) as { total_spent: number } | null;

              const newTotal = Math.max(0, (currentTotal?.total_spent || 0) - expense.amount);
              db.runSync(
                'UPDATE groups SET total_spent = ?, updated_at = ? WHERE id = ?',
                [newTotal, new Date().toISOString(), expense.group_id]
              );
            });
          }

          set((state) => ({
            expenses: state.expenses.filter(expense => expense.id !== id),
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete expense',
            isLoading: false 
          });
          throw error;
        }
      },

      getExpenseSplits: async (expenseId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const result = db.getAllSync(
            `SELECT es.*, u.name as user_name, u.email as user_email 
             FROM expense_splits es
             JOIN users u ON es.user_id = u.id
             WHERE es.expense_id = ?
             ORDER BY u.name ASC`,
            [expenseId]
          ) as any[];

          const splits: ExpenseSplit[] = result.map(row => ({
            id: row.id,
            expense_id: row.expense_id,
            user_id: row.user_id,
            amount: row.amount,
            is_settled: row.is_settled === 1,
            created_at: row.created_at,
            user: {
              id: row.user_id,
              name: row.user_name,
              email: row.user_email,
              created_at: '',
              updated_at: ''
            }
          }));

          set({ isLoading: false });
          return splits;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load expense splits',
            isLoading: false 
          });
          throw error;
        }
      },

      calculateGroupBalances: async (groupId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          
          const members = db.getAllSync(
            `SELECT DISTINCT u.id, u.name, u.email 
             FROM users u 
             JOIN group_members gm ON u.id = gm.user_id 
             WHERE gm.group_id = ? AND gm.is_active = 1`,
            [groupId]
          ) as any[];

          const balances: Balance[] = members.map(member => ({
            user_id: member.id,
            user: {
              id: member.id,
              name: member.name,
              email: member.email,
              created_at: '',
              updated_at: ''
            },
            balance: 0,
            owes: {},
            owed_by: {}
          }));

          const payments = db.getAllSync(
            `SELECT paid_by, SUM(amount) as total_paid 
             FROM expenses 
             WHERE group_id = ? 
             GROUP BY paid_by`,
            [groupId]
          ) as any[];

          const owes = db.getAllSync(
            `SELECT es.user_id, SUM(es.amount) as total_owes 
             FROM expense_splits es
             JOIN expenses e ON es.expense_id = e.id
             WHERE e.group_id = ? 
             GROUP BY es.user_id`,
            [groupId]
          ) as any[];

          payments.forEach(payment => {
            const balance = balances.find(b => b.user_id === payment.paid_by);
            if (balance) {
              balance.balance += payment.total_paid;
            }
          });

          owes.forEach(owe => {
            const balance = balances.find(b => b.user_id === owe.user_id);
            if (balance) {
              balance.balance -= owe.total_owes;
            }
          });

          set({ isLoading: false });
          return balances;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to calculate balances',
            isLoading: false 
          });
          throw error;
        }
      },

      settleExpense: async (expenseId: string, userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          
          db.runSync(
            'UPDATE expense_splits SET is_settled = 1 WHERE expense_id = ? AND user_id = ?',
            [expenseId, userId]
          );

          set({ isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to settle expense',
            isLoading: false 
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'expense-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        expenses: state.expenses 
      }),
    }
  )
);