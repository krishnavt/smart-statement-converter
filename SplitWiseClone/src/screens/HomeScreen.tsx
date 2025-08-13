import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Surface, Card, Title, Paragraph, FAB, Button, Text, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useUserStore } from '../store/simpleUserStore';
import { useGroupStore } from '../store/simpleGroupStore';
import { SplitCalculator } from '../utils/splitCalculator';
import { Balance } from '../types';

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { currentUser, createUser, setCurrentUser } = useUserStore();
  const { groups, getAllGroups } = useGroupStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<any[]>([]);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    if (!currentUser) {
      // Create a default user for demo
      const user = await createUser({
        name: 'Demo User',
        email: 'demo@example.com',
      });
      setCurrentUser(user);
    }
    
    loadDashboardData();
  };

  const loadDashboardData = async () => {
    if (!currentUser) return;

    try {
      const userGroups = await getAllGroups(currentUser.id);
      let totalUserBalance = 125.50; // Mock balance for demo
      
      setTotalBalance(totalUserBalance);
      setRecentExpenses([]);
      setPendingSettlements([]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getBalanceColor = (balance: number) => {
    return SplitCalculator.getBalanceColor(balance);
  };

  const getBalanceText = (balance: number) => {
    if (balance > 0.01) return `You are owed ${SplitCalculator.formatCurrency(balance)}`;
    if (balance < -0.01) return `You owe ${SplitCalculator.formatCurrency(Math.abs(balance))}`;
    return 'You are all settled up!';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Welcome Header */}
        <Surface style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Title style={styles.welcomeText}>
                Welcome back{currentUser ? `, ${currentUser.name}` : ''}!
              </Title>
              <Paragraph style={styles.subtitle}>
                Here's your expense overview
              </Paragraph>
            </View>
            <Avatar.Text 
              size={50} 
              label={currentUser?.name?.charAt(0) || 'U'} 
              style={styles.avatar}
            />
          </View>
        </Surface>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <Card.Content style={styles.balanceContent}>
            <View style={styles.balanceRow}>
              <Ionicons 
                name="wallet" 
                size={24} 
                color={getBalanceColor(totalBalance)} 
              />
              <View style={styles.balanceText}>
                <Title style={[styles.balanceAmount, { color: getBalanceColor(totalBalance) }]}>
                  {SplitCalculator.formatCurrency(Math.abs(totalBalance))}
                </Title>
                <Text style={styles.balanceStatus}>
                  {getBalanceText(totalBalance)}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Quick Actions</Title>
            <View style={styles.actionRow}>
              <Button 
                mode="contained" 
                icon="plus" 
                style={styles.actionButton}
                onPress={() => navigation.navigate('AddExpense')}
              >
                Add Expense
              </Button>
              <Button 
                mode="outlined" 
                icon="account-group" 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Groups')}
              >
                Manage Groups
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Groups Overview */}
        <Card style={styles.overviewCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Title style={styles.sectionTitle}>Your Groups</Title>
              <Button 
                mode="text" 
                onPress={() => navigation.navigate('Groups')}
              >
                View All
              </Button>
            </View>
            
            {groups.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No groups yet</Text>
                <Button 
                  mode="contained" 
                  onPress={() => navigation.navigate('Groups')}
                  style={styles.emptyButton}
                >
                  Create Your First Group
                </Button>
              </View>
            ) : (
              groups.slice(0, 3).map((group) => (
                <Card key={group.id} style={styles.groupCard}>
                  <Card.Content style={styles.groupContent}>
                    <View>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <Text style={styles.groupTotal}>
                        Total: {SplitCalculator.formatCurrency(group.total_spent)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </Card.Content>
                </Card>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Recent Activity */}
        <Card style={styles.overviewCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Recent Activity</Title>
            {recentExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No recent expenses</Text>
              </View>
            ) : (
              recentExpenses.map((expense) => (
                <Card key={expense.id} style={styles.expenseCard}>
                  <Card.Content style={styles.expenseContent}>
                    <View>
                      <Text style={styles.expenseDescription}>{expense.description}</Text>
                      <Text style={styles.expenseDate}>{expense.created_at}</Text>
                    </View>
                    <Text style={styles.expenseAmount}>
                      {SplitCalculator.formatCurrency(expense.amount)}
                    </Text>
                  </Card.Content>
                </Card>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddExpense')}
        label="Add Expense"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  avatar: {
    backgroundColor: '#6200EE',
  },
  balanceCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    elevation: 2,
  },
  balanceContent: {
    padding: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceText: {
    marginLeft: 16,
    flex: 1,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  balanceStatus: {
    fontSize: 16,
    opacity: 0.8,
    marginTop: 4,
  },
  actionCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  overviewCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 8,
    marginBottom: 16,
  },
  emptyButton: {
    marginTop: 8,
  },
  groupCard: {
    marginBottom: 8,
    elevation: 1,
  },
  groupContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupTotal: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  expenseCard: {
    marginBottom: 8,
    elevation: 1,
  },
  expenseContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseDate: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6200EE',
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#6200EE',
  },
});