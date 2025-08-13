import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group, GroupMember, User } from '../types';
import { databaseManager } from '../database/schema';

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createGroup: (groupData: Omit<Group, 'id' | 'created_at' | 'updated_at' | 'total_spent'>, memberIds: string[]) => Promise<Group>;
  getGroupById: (id: string) => Group | null;
  getAllGroups: (userId: string) => Promise<Group[]>;
  updateGroup: (id: string, updates: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addMemberToGroup: (groupId: string, userId: string) => Promise<void>;
  removeMemberFromGroup: (groupId: string, userId: string) => Promise<void>;
  getGroupMembers: (groupId: string) => Promise<GroupMember[]>;
  setCurrentGroup: (group: Group | null) => void;
  clearError: () => void;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set, get) => ({
      groups: [],
      currentGroup: null,
      isLoading: false,
      error: null,

      createGroup: async (groupData, memberIds) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const groupId = databaseManager.generateId();
          const timestamp = new Date().toISOString();
          
          const group: Group = {
            id: groupId,
            ...groupData,
            created_at: timestamp,
            updated_at: timestamp,
            total_spent: 0,
          };

          db.withTransactionSync(() => {
            db.runSync(
              `INSERT INTO groups (id, name, description, created_by, created_at, updated_at, total_spent) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [group.id, group.name, group.description || null, group.created_by, group.created_at, group.updated_at, group.total_spent]
            );

            memberIds.forEach(userId => {
              const memberId = databaseManager.generateId();
              db.runSync(
                `INSERT INTO group_members (id, group_id, user_id, joined_at, is_active) 
                 VALUES (?, ?, ?, ?, ?)`,
                [memberId, groupId, userId, timestamp, 1]
              );
            });
          });

          set((state) => ({
            groups: [...state.groups, group],
            isLoading: false,
          }));

          return group;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to create group',
            isLoading: false 
          });
          throw error;
        }
      },

      getGroupById: (id: string) => {
        const { groups } = get();
        return groups.find(group => group.id === id) || null;
      },

      getAllGroups: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const result = db.getAllSync(`
            SELECT DISTINCT g.* 
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ? AND gm.is_active = 1
            ORDER BY g.updated_at DESC
          `, [userId]) as Group[];
          
          set({ 
            groups: result,
            isLoading: false 
          });
          
          return result;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load groups',
            isLoading: false 
          });
          throw error;
        }
      },

      updateGroup: async (id: string, updates: Partial<Group>) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const timestamp = new Date().toISOString();
          
          const updateFields = [];
          const values = [];
          
          if (updates.name) {
            updateFields.push('name = ?');
            values.push(updates.name);
          }
          if (updates.description !== undefined) {
            updateFields.push('description = ?');
            values.push(updates.description);
          }
          if (updates.total_spent !== undefined) {
            updateFields.push('total_spent = ?');
            values.push(updates.total_spent);
          }
          
          updateFields.push('updated_at = ?');
          values.push(timestamp);
          values.push(id);

          db.runSync(
            `UPDATE groups SET ${updateFields.join(', ')} WHERE id = ?`,
            values
          );

          set((state) => ({
            groups: state.groups.map(group => 
              group.id === id 
                ? { ...group, ...updates, updated_at: timestamp }
                : group
            ),
            currentGroup: state.currentGroup?.id === id 
              ? { ...state.currentGroup, ...updates, updated_at: timestamp }
              : state.currentGroup,
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update group',
            isLoading: false 
          });
          throw error;
        }
      },

      deleteGroup: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          
          db.withTransactionSync(() => {
            db.runSync('DELETE FROM settlements WHERE group_id = ?', [id]);
            db.runSync('DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id = ?)', [id]);
            db.runSync('DELETE FROM expenses WHERE group_id = ?', [id]);
            db.runSync('DELETE FROM group_members WHERE group_id = ?', [id]);
            db.runSync('DELETE FROM groups WHERE id = ?', [id]);
          });

          set((state) => ({
            groups: state.groups.filter(group => group.id !== id),
            currentGroup: state.currentGroup?.id === id ? null : state.currentGroup,
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete group',
            isLoading: false 
          });
          throw error;
        }
      },

      addMemberToGroup: async (groupId: string, userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const memberId = databaseManager.generateId();
          const timestamp = new Date().toISOString();
          
          db.runSync(
            `INSERT INTO group_members (id, group_id, user_id, joined_at, is_active) 
             VALUES (?, ?, ?, ?, ?)`,
            [memberId, groupId, userId, timestamp, 1]
          );

          set({ isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to add member',
            isLoading: false 
          });
          throw error;
        }
      },

      removeMemberFromGroup: async (groupId: string, userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          
          db.runSync(
            `UPDATE group_members SET is_active = 0 WHERE group_id = ? AND user_id = ?`,
            [groupId, userId]
          );

          set({ isLoading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to remove member',
            isLoading: false 
          });
          throw error;
        }
      },

      getGroupMembers: async (groupId: string) => {
        set({ isLoading: true, error: null });
        try {
          const db = databaseManager.getDatabase();
          const result = db.getAllSync(`
            SELECT gm.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND gm.is_active = 1
            ORDER BY gm.joined_at ASC
          `, [groupId]) as any[];
          
          const members: GroupMember[] = result.map(row => ({
            id: row.id,
            group_id: row.group_id,
            user_id: row.user_id,
            joined_at: row.joined_at,
            is_active: row.is_active,
            user: {
              id: row.user_id,
              name: row.user_name,
              email: row.user_email,
              avatar: row.user_avatar,
              created_at: '',
              updated_at: ''
            }
          }));
          
          set({ isLoading: false });
          return members;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load group members',
            isLoading: false 
          });
          throw error;
        }
      },

      setCurrentGroup: (group: Group | null) => {
        set({ currentGroup: group });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'group-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        groups: state.groups,
        currentGroup: state.currentGroup 
      }),
    }
  )
);