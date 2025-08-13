import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, Text, Avatar, Chip, Surface, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useUserStore } from '../store/userStore';
import { useGroupStore } from '../store/groupStore';
import { useExpenseStore } from '../store/expenseStore';
import { useSettlementStore } from '../store/settlementStore';
import { SplitCalculator } from '../utils/splitCalculator';
import { Expense, Settlement } from '../types';

interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement';
  data: Expense | Settlement;
  timestamp: string;
  groupName?: string;
}

interface ActivitiesScreenProps {
  navigation: any;
}

export default function ActivitiesScreen({ navigation }: ActivitiesScreenProps) {
  const { currentUser } = useUserStore();
  const { groups, getAllGroups } = useGroupStore();
  const { getGroupExpenses } = useExpenseStore();
  const { getUserSettlements } = useSettlementStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'expenses' | 'settlements'>('all');

  useEffect(() => {
    loadActivities();
  }, [currentUser, filter]);

  const loadActivities = async () => {
    if (!currentUser) return;

    try {
      const userGroups = await getAllGroups(currentUser.id);
      const allActivities: ActivityItem[] = [];

      // Load expenses from all groups
      if (filter === 'all' || filter === 'expenses') {
        for (const group of userGroups) {
          const expenses = await getGroupExpenses(group.id);
          expenses.forEach(expense => {
            allActivities.push({
              id: `expense_${expense.id}`,
              type: 'expense',
              data: expense,
              timestamp: expense.created_at,
              groupName: group.name
            });
          });
        }
      }

      // Load settlements
      if (filter === 'all' || filter === 'settlements') {
        const settlements = await getUserSettlements(currentUser.id);
        settlements.forEach(settlement => {
          const group = userGroups.find(g => g.id === settlement.group_id);
          allActivities.push({
            id: `settlement_${settlement.id}`,
            type: 'settlement',
            data: settlement,
            timestamp: settlement.created_at,
            groupName: group?.name
          });
        });
      }

      // Sort by timestamp (newest first)
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setActivities(allActivities);
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const renderExpenseActivity = (activity: ActivityItem) => {
    const expense = activity.data as Expense;
    const isPaidByUser = expense.paid_by === currentUser?.id;
    
    return (
      <Card key={activity.id} style={styles.activityCard}>
        <Card.Content style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Avatar.Icon 
              size={40} 
              icon="receipt" 
              style={[styles.activityIcon, { backgroundColor: isPaidByUser ? '#4CAF50' : '#2196F3' }]}
            />
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>{expense.description}</Text>
              <Text style={styles.activitySubtitle}>
                {isPaidByUser ? 'You paid' : `${expense.paid_by_user?.name} paid`} • {activity.groupName}
              </Text>
              <Text style={styles.activityTime}>{formatDate(activity.timestamp)}</Text>
            </View>
            <View style={styles.activityAmount}>
              <Text style={[styles.amountText, { color: isPaidByUser ? '#4CAF50' : '#2196F3' }]}>
                {SplitCalculator.formatCurrency(expense.amount)}
              </Text>
              {expense.category && (
                <Chip style={styles.categoryChip} textStyle={styles.categoryText}>
                  {expense.category}
                </Chip>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderSettlementActivity = (activity: ActivityItem) => {
    const settlement = activity.data as Settlement;
    const isUserPaying = settlement.from_user === currentUser?.id;
    const isUserReceiving = settlement.to_user === currentUser?.id;
    
    return (
      <Card key={activity.id} style={styles.activityCard}>
        <Card.Content style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Avatar.Icon 
              size={40} 
              icon="cash" 
              style={[styles.activityIcon, { backgroundColor: settlement.is_completed ? '#4CAF50' : '#FF9800' }]}
            />
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>
                {isUserPaying && 'You paid'}
                {isUserReceiving && 'You received'}
                {!isUserPaying && !isUserReceiving && 'Settlement'}
              </Text>
              <Text style={styles.activitySubtitle}>
                {isUserPaying && `to ${settlement.to_user_data?.name}`}
                {isUserReceiving && `from ${settlement.from_user_data?.name}`}
                {!isUserPaying && !isUserReceiving && 
                  `${settlement.from_user_data?.name} → ${settlement.to_user_data?.name}`}
                • {activity.groupName}
              </Text>
              <Text style={styles.activityTime}>{formatDate(activity.timestamp)}</Text>
            </View>
            <View style={styles.activityAmount}>
              <Text style={[styles.amountText, { 
                color: isUserReceiving ? '#4CAF50' : isUserPaying ? '#F44336' : '#2196F3' 
              }]}>
                {SplitCalculator.formatCurrency(settlement.amount)}
              </Text>
              <Chip 
                style={[styles.statusChip, { 
                  backgroundColor: settlement.is_completed ? '#E8F5E8' : '#FFF3E0' 
                }]}
                textStyle={[styles.statusText, { 
                  color: settlement.is_completed ? '#4CAF50' : '#FF9800' 
                }]}
              >
                {settlement.is_completed ? 'Completed' : 'Pending'}
              </Chip>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderActivity = (activity: ActivityItem) => {
    if (activity.type === 'expense') {
      return renderExpenseActivity(activity);
    } else {
      return renderSettlementActivity(activity);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <Surface style={styles.header}>
          <Title style={styles.headerTitle}>Recent Activity</Title>
          <Paragraph style={styles.headerSubtitle}>
            {activities.length} recent {activities.length === 1 ? 'activity' : 'activities'}
          </Paragraph>
        </Surface>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <Button
            mode={filter === 'all' ? 'contained' : 'outlined'}
            onPress={() => setFilter('all')}
            style={styles.filterButton}
            compact
          >
            All
          </Button>
          <Button
            mode={filter === 'expenses' ? 'contained' : 'outlined'}
            onPress={() => setFilter('expenses')}
            style={styles.filterButton}
            compact
          >
            Expenses
          </Button>
          <Button
            mode={filter === 'settlements' ? 'contained' : 'outlined'}
            onPress={() => setFilter('settlements')}
            style={styles.filterButton}
            compact
          >
            Settlements
          </Button>
        </View>

        {/* Activities List */}
        <View style={styles.activitiesList}>
          {activities.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Ionicons name="time-outline" size={64} color="#ccc" />
                <Title style={styles.emptyTitle}>No activity yet</Title>
                <Paragraph style={styles.emptyDescription}>
                  {filter === 'all' && 'Start by creating a group and adding expenses'}
                  {filter === 'expenses' && 'No expenses have been added yet'}
                  {filter === 'settlements' && 'No settlements have been made yet'}
                </Paragraph>
                <Button 
                  mode="contained" 
                  onPress={() => navigation.navigate('Groups')}
                  style={styles.emptyButton}
                >
                  Get Started
                </Button>
              </Card.Content>
            </Card>
          ) : (
            activities.map(renderActivity)
          )}
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
  },
  activitiesList: {
    paddingHorizontal: 16,
  },
  activityCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  activityContent: {
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityIcon: {
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    opacity: 0.5,
  },
  activityAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categoryChip: {
    backgroundColor: '#E3F2FD',
    height: 24,
  },
  categoryText: {
    fontSize: 12,
    color: '#1976D2',
  },
  statusChip: {
    height: 24,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: 12,
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
});