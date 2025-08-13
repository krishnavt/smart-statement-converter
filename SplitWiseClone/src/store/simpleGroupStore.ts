import { create } from 'zustand';
import { Group } from '../types';
import { mockDatabaseManager as databaseManager } from '../database/mockDatabase';

interface GroupState {
  groups: Group[];
  currentGroup: Group | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  getAllGroups: (userId: string) => Promise<Group[]>;
  getGroupById: (id: string) => Group | null;
  setCurrentGroup: (group: Group | null) => void;
  clearError: () => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  currentGroup: null,
  isLoading: false,
  error: null,

  getAllGroups: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await databaseManager.getUserGroups(userId);
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

  getGroupById: (id: string) => {
    const { groups } = get();
    return groups.find(group => group.id === id) || null;
  },

  setCurrentGroup: (group: Group | null) => {
    set({ currentGroup: group });
  },

  clearError: () => {
    set({ error: null });
  },
}));