import { create } from 'zustand';
import { User } from '../types';
import { mockDatabaseManager as databaseManager } from '../database/mockDatabase';

interface UserState {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentUser: (user: User) => void;
  createUser: (userData: Omit<User, 'id' | 'created_at' | 'updated_at'>) => Promise<User>;
  getUserById: (id: string) => User | null;
  getAllUsers: () => Promise<User[]>;
  clearError: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  currentUser: null,
  users: [],
  isLoading: false,
  error: null,

  setCurrentUser: (user: User) => {
    set({ currentUser: user });
  },

  createUser: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const user = await databaseManager.createUser(userData);
      set((state) => ({
        users: [...state.users, user],
        isLoading: false,
      }));
      return user;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create user',
        isLoading: false 
      });
      throw error;
    }
  },

  getUserById: (id: string) => {
    const { users } = get();
    return users.find(user => user.id === id) || null;
  },

  getAllUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await databaseManager.getAllUsers();
      set({ 
        users: result,
        isLoading: false 
      });
      return result;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load users',
        isLoading: false 
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));