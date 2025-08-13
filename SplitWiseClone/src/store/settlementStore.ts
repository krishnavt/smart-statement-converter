import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settlement, Balance } from '../types';
import { databaseManager } from '../database/schema';
import { SplitCalculator, SettlementSuggestion } from '../utils/splitCalculator';

interface SettlementState {
  settlements: Settlement[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createSettlement: (settlementData: Omit<Settlement, 'id' | 'created_at' | 'completed_at'>) => Promise<Settlement>;
  getGroupSettlements: (groupId: string) => Promise<Settlement[]>;
  markSettlementComplete: (settlementId: string) => Promise<void>;
  deleteSettlement: (settlementId: string) => Promise<void>;
  generateSettlementSuggestions: (groupId: string) => Promise<SettlementSuggestion[]>;
  getSettlementById: (id: string) => Settlement | null;
  getUserSettlements: (userId: string) => Promise<Settlement[]>;
  clearError: () => void;
}

export const useSettlementStore = create<SettlementState>()(
  persist(
    (set, get) => ({
      settlements: [],
      isLoading: false,
      error: null,

      createSettlement: async (settlementData) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const settlementId = databaseManager.generateId();
          const timestamp = new Date().toISOString();
          
          const settlement: Settlement = {
            id: settlementId,
            ...settlementData,
            created_at: timestamp,
          };

          db.runSync(
            `INSERT INTO settlements (id, group_id, from_user, to_user, amount, is_completed, created_at, completed_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              settlement.id,
              settlement.group_id,
              settlement.from_user,
              settlement.to_user,
              settlement.amount,
              settlement.is_completed ? 1 : 0,
              settlement.created_at,
              settlement.completed_at || null
            ]
          );

          set((state) => ({
            settlements: [...state.settlements, settlement],
            isLoading: false,
          }));

          return settlement;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create settlement',
            isLoading: false 
          });
          throw error;
        }
      },

      getGroupSettlements: async (groupId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const result = db.getAllSync(
            `SELECT s.*, 
                    fu.name as from_user_name, fu.email as from_user_email, fu.avatar as from_user_avatar,
                    tu.name as to_user_name, tu.email as to_user_email, tu.avatar as to_user_avatar
             FROM settlements s
             JOIN users fu ON s.from_user = fu.id
             JOIN users tu ON s.to_user = tu.id
             WHERE s.group_id = ?
             ORDER BY s.created_at DESC`,
            [groupId]
          ) as any[];

          const settlements: Settlement[] = result.map(row => ({
            id: row.id,
            group_id: row.group_id,
            from_user: row.from_user,
            to_user: row.to_user,
            amount: row.amount,
            is_completed: row.is_completed === 1,
            created_at: row.created_at,
            completed_at: row.completed_at,
            from_user_data: {
              id: row.from_user,
              name: row.from_user_name,
              email: row.from_user_email,
              avatar: row.from_user_avatar,
              created_at: '',
              updated_at: ''
            },
            to_user_data: {
              id: row.to_user,
              name: row.to_user_name,
              email: row.to_user_email,
              avatar: row.to_user_avatar,
              created_at: '',
              updated_at: ''
            }
          }));

          set({ 
            settlements,
            isLoading: false 
          });

          return settlements;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load settlements',
            isLoading: false 
          });
          throw error;
        }
      },

      markSettlementComplete: async (settlementId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const timestamp = new Date().toISOString();
          
          db.runSync(
            'UPDATE settlements SET is_completed = 1, completed_at = ? WHERE id = ?',
            [timestamp, settlementId]
          );

          set((state) => ({
            settlements: state.settlements.map(settlement => 
              settlement.id === settlementId 
                ? { ...settlement, is_completed: true, completed_at: timestamp }
                : settlement
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to complete settlement',
            isLoading: false 
          });
          throw error;
        }
      },

      deleteSettlement: async (settlementId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          
          db.runSync('DELETE FROM settlements WHERE id = ?', [settlementId]);

          set((state) => ({
            settlements: state.settlements.filter(settlement => settlement.id !== settlementId),
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete settlement',
            isLoading: false 
          });
          throw error;
        }
      },

      generateSettlementSuggestions: async (groupId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          
          // Get all group members
          const members = db.getAllSync(
            `SELECT DISTINCT u.id, u.name, u.email 
             FROM users u 
             JOIN group_members gm ON u.id = gm.user_id 
             WHERE gm.group_id = ? AND gm.is_active = 1`,
            [groupId]
          ) as any[];

          // Calculate balances for each member
          const balances: Balance[] = [];
          
          for (const member of members) {
            // Calculate total paid by this member
            const totalPaid = db.getFirstSync(
              `SELECT COALESCE(SUM(amount), 0) as total 
               FROM expenses 
               WHERE group_id = ? AND paid_by = ?`,
              [groupId, member.id]
            ) as { total: number };

            // Calculate total owed by this member
            const totalOwed = db.getFirstSync(
              `SELECT COALESCE(SUM(es.amount), 0) as total 
               FROM expense_splits es
               JOIN expenses e ON es.expense_id = e.id
               WHERE e.group_id = ? AND es.user_id = ?`,
              [groupId, member.id]
            ) as { total: number };

            const balance = totalPaid.total - totalOwed.total;

            balances.push({
              user_id: member.id,
              user: {
                id: member.id,
                name: member.name,
                email: member.email,
                created_at: '',
                updated_at: ''
              },
              balance: Math.round(balance * 100) / 100,
              owes: {},
              owed_by: {}
            });
          }

          // Generate optimal settlement suggestions
          const suggestions = SplitCalculator.calculateOptimalSettlements(balances);

          set({ isLoading: false });
          return suggestions;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to generate settlement suggestions',
            isLoading: false 
          });
          throw error;
        }
      },

      getSettlementById: (id: string) => {
        const { settlements } = get();
        return settlements.find(settlement => settlement.id === id) || null;
      },

      getUserSettlements: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const result = db.getAllSync(
            `SELECT s.*, 
                    fu.name as from_user_name, fu.email as from_user_email, fu.avatar as from_user_avatar,
                    tu.name as to_user_name, tu.email as to_user_email, tu.avatar as to_user_avatar,
                    g.name as group_name
             FROM settlements s
             JOIN users fu ON s.from_user = fu.id
             JOIN users tu ON s.to_user = tu.id
             JOIN groups g ON s.group_id = g.id
             WHERE s.from_user = ? OR s.to_user = ?
             ORDER BY s.created_at DESC`,
            [userId, userId]
          ) as any[];

          const settlements: Settlement[] = result.map(row => ({
            id: row.id,
            group_id: row.group_id,
            from_user: row.from_user,
            to_user: row.to_user,
            amount: row.amount,
            is_completed: row.is_completed === 1,
            created_at: row.created_at,
            completed_at: row.completed_at,
            from_user_data: {
              id: row.from_user,
              name: row.from_user_name,
              email: row.from_user_email,
              avatar: row.from_user_avatar,
              created_at: '',
              updated_at: ''
            },
            to_user_data: {
              id: row.to_user,
              name: row.to_user_name,
              email: row.to_user_email,
              avatar: row.to_user_avatar,
              created_at: '',
              updated_at: ''
            }
          }));

          set({ isLoading: false });
          return settlements;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load user settlements',
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
      name: 'settlement-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        settlements: state.settlements 
      }),
    }
  )
);