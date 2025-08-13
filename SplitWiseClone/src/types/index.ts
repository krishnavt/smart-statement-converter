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
  members?: GroupMember[];
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  user?: User;
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
  paid_by_user?: User;
  created_at: string;
  updated_at: string;
  category?: string;
  receipt_image?: string;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  user?: User;
  amount: number;
  is_settled: boolean;
  created_at: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  from_user_data?: User;
  to_user_data?: User;
  amount: number;
  is_completed: boolean;
  created_at: string;
  completed_at?: string;
}

export interface Balance {
  user_id: string;
  user?: User;
  balance: number;
  owes: { [userId: string]: number };
  owed_by: { [userId: string]: number };
}

export interface ExpenseFormData {
  description: string;
  amount: string;
  category?: string;
  splits: { [userId: string]: string };
  paid_by: string;
}

export interface GroupFormData {
  name: string;
  description?: string;
  members: string[];
}

export type SplitType = 'equal' | 'exact' | 'percentage';

export interface SplitOption {
  type: SplitType;
  values?: { [userId: string]: number };
}