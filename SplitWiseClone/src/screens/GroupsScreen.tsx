import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, FAB, Button, Text, Avatar, Chip, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useUserStore } from '../store/userStore';
import { useGroupStore } from '../store/groupStore';
import { useExpenseStore } from '../store/expenseStore';
import { SplitCalculator } from '../utils/splitCalculator';
import { Group, Balance } from '../types';

interface GroupsScreenProps {
  navigation: any;
}

export default function GroupsScreen({ navigation }: GroupsScreenProps) {
  const { currentUser } = useUserStore();
  const { groups, getAllGroups, isLoading } = useGroupStore();
  const { calculateGroupBalances } = useExpenseStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [groupBalances, setGroupBalances] = useState<{ [groupId: string]: Balance[] }>({});

  useEffect(() => {
    loadGroups();
  }, [currentUser]);

  const loadGroups = async () => {
    if (!currentUser) return;

    try {
      const userGroups = await getAllGroups(currentUser.id);
      
      // Load balances for each group
      const balances: { [groupId: string]: Balance[] } = {};
      for (const group of userGroups) {
        const groupBalances = await calculateGroupBalances(group.id);
        balances[group.id] = groupBalances;
      }
      setGroupBalances(balances);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  const getUserBalanceInGroup = (groupId: string): number => {
    if (!currentUser || !groupBalances[groupId]) return 0;
    const userBalance = groupBalances[groupId].find(b => b.user_id === currentUser.id);
    return userBalance?.balance || 0;
  };

  const getBalanceColor = (balance: number) => {
    return SplitCalculator.getBalanceColor(balance);
  };

  const getBalanceStatus = (balance: number) => {
    return SplitCalculator.getBalanceStatus(balance);
  };

  const renderGroupCard = (group: Group) => {
    const userBalance = getUserBalanceInGroup(group.id);
    const balanceStatus = getBalanceStatus(userBalance);
    const balanceColor = getBalanceColor(userBalance);

    return (
      <Card 
        key={group.id} 
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetails', { groupId: group.id })}
      >
        <Card.Content style={styles.groupContent}>
          <View style={styles.groupHeader}>
            <View style={styles.groupInfo}>
              <Avatar.Text 
                size={40} 
                label={group.name.charAt(0).toUpperCase()} 
                style={[styles.groupAvatar, { backgroundColor: balanceColor }]}
              />
              <View style={styles.groupDetails}>
                <Title style={styles.groupName}>{group.name}</Title>
                {group.description && (
                  <Paragraph style={styles.groupDescription} numberOfLines={1}>
                    {group.description}
                  </Paragraph>
                )}
                <Text style={styles.groupTotal}>
                  Total spent: {SplitCalculator.formatCurrency(group.total_spent)}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </View>

          {/* Balance Status */}
          <View style={styles.balanceSection}>
            <Chip 
              mode="outlined"
              style={[styles.balanceChip, { borderColor: balanceColor }]}
              textStyle={{ color: balanceColor, fontWeight: '600' }}
            >
              {balanceStatus === 'settled' && 'Settled up'}
              {balanceStatus === 'owed' && `You are owed ${SplitCalculator.formatCurrency(userBalance)}`}
              {balanceStatus === 'owes' && `You owe ${SplitCalculator.formatCurrency(Math.abs(userBalance))}`}
            </Chip>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Button 
              mode="outlined" 
              compact 
              style={styles.actionButton}
              onPress={() => navigation.navigate('AddExpense', { groupId: group.id })}
            >
              Add Expense
            </Button>
            <Button 
              mode="text" 
              compact 
              style={styles.actionButton}
              onPress={() => navigation.navigate('GroupBalances', { groupId: group.id })}
            >
              Settle Up
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
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
          <Title style={styles.headerTitle}>Your Groups</Title>
          <Paragraph style={styles.headerSubtitle}>
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </Paragraph>
        </Surface>

        {/* Groups List */}
        <View style={styles.groupsList}>
          {groups.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Ionicons name="people-outline" size={64} color="#ccc" />
                <Title style={styles.emptyTitle}>No groups yet</Title>
                <Paragraph style={styles.emptyDescription}>
                  Create your first group to start splitting expenses with friends
                </Paragraph>
                <Button 
                  mode="contained" 
                  onPress={() => navigation.navigate('CreateGroup')}
                  style={styles.emptyButton}
                >
                  Create Group
                </Button>
              </Card.Content>
            </Card>
          ) : (
            groups.map(renderGroupCard)
          )}
        </View>

        {/* Statistics */}
        {groups.length > 0 && (
          <Card style={styles.statsCard}>
            <Card.Content>
              <Title style={styles.statsTitle}>Your Overview</Title>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{groups.length}</Text>
                  <Text style={styles.statLabel}>Groups</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {SplitCalculator.formatCurrency(
                      groups.reduce((total, group) => total + group.total_spent, 0)
                    )}
                  </Text>
                  <Text style={styles.statLabel}>Total Expenses</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: getBalanceColor(
                    Object.values(groupBalances).flat()
                      .filter(b => b.user_id === currentUser?.id)
                      .reduce((sum, b) => sum + b.balance, 0)
                  )}]}>
                    {SplitCalculator.formatCurrency(Math.abs(
                      Object.values(groupBalances).flat()
                        .filter(b => b.user_id === currentUser?.id)
                        .reduce((sum, b) => sum + b.balance, 0)
                    ))}
                  </Text>
                  <Text style={styles.statLabel}>Net Balance</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGroup')}
        label="New Group"
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  groupsList: {
    paddingHorizontal: 16,
  },
  groupCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  groupContent: {
    padding: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  groupAvatar: {
    marginRight: 12,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  groupTotal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  balanceSection: {
    marginBottom: 12,
  },
  balanceChip: {
    alignSelf: 'flex-start',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
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
  statsCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#6200EE',
  },
});