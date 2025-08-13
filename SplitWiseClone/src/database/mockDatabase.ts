import { User, Group, Expense, Settlement } from '../types';

// Mock database for testing without SQLite plugin
export class MockDatabaseManager {
  private users: User[] = [];
  private groups: Group[] = [];
  private expenses: Expense[] = [];
  private settlements: Settlement[] = [];

  constructor() {
    this.initializeWithSampleData();
  }

  private initializeWithSampleData() {
    // Create sample users
    this.users = [
      {
        id: 'user1',
        name: 'Demo User',
        email: 'demo@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'user2',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'user3',
        name: 'Bob Smith',
        email: 'bob@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Create sample groups
    this.groups = [
      {
        id: 'group1',
        name: 'Weekend Trip',
        description: 'Mountain cabin weekend',
        created_by: 'user1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_spent: 450.75,
      },
      {
        id: 'group2',
        name: 'Apartment Expenses',
        description: 'Shared apartment costs',
        created_by: 'user1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_spent: 1200.00,
      },
    ];

    // Create sample expenses
    this.expenses = [
      {
        id: 'expense1',
        group_id: 'group1',
        description: 'Grocery shopping',
        amount: 85.50,
        currency: 'USD',
        paid_by: 'user1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: 'Food',
      },
      {
        id: 'expense2',
        group_id: 'group1',
        description: 'Gas for the trip',
        amount: 65.25,
        currency: 'USD',
        paid_by: 'user2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: 'Transportation',
      },
    ];
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // User operations
  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.push(user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users];
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const index = this.users.findIndex(user => user.id === id);
    if (index >= 0) {
      this.users[index] = { 
        ...this.users[index], 
        ...updates, 
        updated_at: new Date().toISOString() 
      };
    }
  }

  // Group operations
  async createGroup(groupData: Omit<Group, 'id' | 'created_at' | 'updated_at' | 'total_spent'>): Promise<Group> {
    const group: Group = {
      id: this.generateId(),
      ...groupData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_spent: 0,
    };
    this.groups.push(group);
    return group;
  }

  async getUserGroups(userId: string): Promise<Group[]> {
    // In a real implementation, this would check group membership
    return [...this.groups];
  }

  async getGroupById(id: string): Promise<Group | null> {
    return this.groups.find(group => group.id === id) || null;
  }

  // Expense operations
  async createExpense(expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>): Promise<Expense> {
    const expense: Expense = {
      id: this.generateId(),
      ...expenseData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.expenses.push(expense);

    // Update group total
    const groupIndex = this.groups.findIndex(g => g.id === expense.group_id);
    if (groupIndex >= 0) {
      this.groups[groupIndex].total_spent += expense.amount;
    }

    return expense;
  }

  async getGroupExpenses(groupId: string): Promise<Expense[]> {
    return this.expenses
      .filter(expense => expense.group_id === groupId)
      .map(expense => ({
        ...expense,
        paid_by_user: this.users.find(u => u.id === expense.paid_by)
      }));
  }

  // Settlement operations  
  async createSettlement(settlementData: Omit<Settlement, 'id' | 'created_at'>): Promise<Settlement> {
    const settlement: Settlement = {
      id: this.generateId(),
      ...settlementData,
      created_at: new Date().toISOString(),
    };
    this.settlements.push(settlement);
    return settlement;
  }

  async getGroupSettlements(groupId: string): Promise<Settlement[]> {
    return this.settlements
      .filter(settlement => settlement.group_id === groupId)
      .map(settlement => ({
        ...settlement,
        from_user_data: this.users.find(u => u.id === settlement.from_user),
        to_user_data: this.users.find(u => u.id === settlement.to_user),
      }));
  }
}

export const mockDatabaseManager = new MockDatabaseManager();