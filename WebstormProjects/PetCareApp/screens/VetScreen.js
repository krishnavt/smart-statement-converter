// screens/VetScreen.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

export function VetScreen() {
    const vetInfo = {
        name: 'Dr. Sarah Wilson',
        clinic: 'Healthy Paws Veterinary',
        phone: '(555) 123-4567',
        address: '123 Pet Care Lane',
        hours: 'Mon-Fri 8am-6pm',
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.vetCard}>
                <Text style={styles.vetName}>{vetInfo.name}</Text>
                <Text style={styles.vetDetails}>{vetInfo.clinic}</Text>
                <Text style={styles.vetDetails}>{vetInfo.phone}</Text>
                <Text style={styles.vetDetails}>{vetInfo.address}</Text>
                <Text style={styles.vetDetails}>{vetInfo.hours}</Text>
            </View>

            <TouchableOpacity style={styles.scheduleButton}>
                <Text style={styles.scheduleButtonText}>Schedule Appointment</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        padding: 16,
    },
    vetCard: {
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
    vetName: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },
    vetDetails: {
        fontSize: 16,
        color: '#4B5563',
        marginBottom: 4,
    },
    scheduleButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    scheduleButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});