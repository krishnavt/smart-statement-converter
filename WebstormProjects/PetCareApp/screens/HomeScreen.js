// screens/HomeScreen.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, Calendar, Activity } from 'lucide-react-native';

export function HomeScreen() {
    return (
        <ScrollView style={styles.container}>
            {/* Next Vet Visit Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Calendar size={24} color="#3b82f6" />
                    <Text style={styles.cardTitle}>Next Vet Visit</Text>
                </View>
                <Text style={styles.dateText}>2025-02-15</Text>
            </View>

            {/* Medication Alerts Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Bell size={24} color="#8b5cf6" />
                    <Text style={styles.cardTitle}>Medication Alerts</Text>
                </View>
                <View style={styles.alertItem}>
                    <Text style={styles.alertText}>Heartworm Prevention</Text>
                    <Text style={[styles.alertText, { color: '#ef4444' }]}>Due in 2 days</Text>
                </View>
                <View style={styles.alertItem}>
                    <Text style={styles.alertText}>Flea Treatment</Text>
                    <Text style={styles.alertText}>Due in 15 days</Text>
                </View>
            </View>

            {/* Health Stats Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Activity size={24} color="#10b981" />
                    <Text style={styles.cardTitle}>Health Stats</Text>
                </View>
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Weight</Text>
                        <Text style={styles.statValue}>65 lbs</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Age</Text>
                        <Text style={styles.statValue}>3 years</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        padding: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    dateText: {
        fontSize: 16,
        color: '#4b5563',
    },
    alertItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    alertText: {
        fontSize: 16,
        color: '#4b5563',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 8,
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
});