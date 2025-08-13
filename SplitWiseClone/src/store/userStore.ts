import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  searchUsers: (query: string) => User[];
  clearError: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
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

      updateUser: async (id: string, updates: Partial<User>) => {
        set({ isLoading: true, error: null });
        try {
          await databaseManager.updateUser(id, updates);
          const timestamp = new Date().toISOString();

          set((state) => ({
            users: state.users.map(user => 
              user.id === id 
                ? { ...user, ...updates, updated_at: timestamp }
                : user
            ),
            currentUser: state.currentUser?.id === id 
              ? { ...state.currentUser, ...updates, updated_at: timestamp }
              : state.currentUser,
            isLoading: false,
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update user',
            isLoading: false 
          });
          throw error;
        }
      },

      searchUsers: (query: string) => {
        const { users } = get();
        const lowercaseQuery = query.toLowerCase();
        
        return users.filter(user => 
          user.name.toLowerCase().includes(lowercaseQuery) ||
          user.email.toLowerCase().includes(lowercaseQuery)
        );
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        currentUser: state.currentUser,
        users: state.users 
      }),
    }
  )
);