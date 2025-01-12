// screens/AlertsScreen.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';

export function AlertsScreen() {
    const alerts = [
        { id: 1, type: 'Medication', message: 'Heartworm Prevention due in 2 days', urgent: true },
        { id: 2, type: 'Supply', message: 'Dog Food running low (5 days remaining)', urgent: true },
        { id: 3, type: 'Medication', message: 'Flea Treatment due in 15 days', urgent: false },
        { id: 4, type: 'Appointment', message: 'Vet visit scheduled for Feb 15, 2025', urgent: false },
    ];

    return (
        <ScrollView style={styles.container}>
            {alerts.map(alert => (
                <View
                    key={alert.id}
                    style={[
                        styles.alertCard,
                        alert.urgent && styles.urgentAlert
                    ]}
                >
                    <View style={styles.alertHeader}>
                        <Bell size={20} color={alert.urgent ? '#EF4444' : '#3B82F6'} />
                        <Text style={styles.alertType}>{alert.type}</Text>
                    </View>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        padding: 16,
    },
    alertCard: {
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
    urgentAlert: {
        borderLeftWidth: 4,
        borderLeftColor: '#EF4444',
    },
    alertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    alertType: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    alertMessage: {
        fontSize: 14,
        color: '#4B5563',
    },
});