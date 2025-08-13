import * as SQLite from 'expo-sqlite';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  total_spent: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  created_at: string;
  updated_at: string;
  category?: string;
  receipt_image?: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  is_settled: boolean;
  created_at: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  is_completed: boolean;
  created_at: string;
  completed_at?: string;
}

export class DatabaseManager {
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync('splitwise_clone.db');
    this.initializeDatabase();
  }

  private initializeDatabase() {
    this.db.execSync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        avatar TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        total_spent REAL DEFAULT 0,
        FOREIGN KEY (created_by) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS group_members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (group_id) REFERENCES groups (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        paid_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        category TEXT,
        receipt_image TEXT,
        FOREIGN KEY (group_id) REFERENCES groups (id),
        FOREIGN KEY (paid_by) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS expense_splits (
        id TEXT PRIMARY KEY,
        expense_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        is_settled BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expense_id) REFERENCES expenses (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        amount REAL NOT NULL,
        is_completed BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (group_id) REFERENCES groups (id),
        FOREIGN KEY (from_user) REFERENCES users (id),
        FOREIGN KEY (to_user) REFERENCES users (id)
      );

      CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
      CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
      CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);
    `);
  }

  getDatabase(): SQLite.SQLiteDatabase {
    return this.db;
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export const databaseManager = new DatabaseManager();