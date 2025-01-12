// screens/PetsScreen.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

export function PetsScreen() {
    const pets = [
        { id: 1, name: 'Max', breed: 'Golden Retriever', age: 3 },
        { id: 2, name: 'Luna', breed: 'Siamese Cat', age: 2 },
    ];

    return (
        <ScrollView style={styles.container}>
            {pets.map(pet => (
                <View key={pet.id} style={styles.petCard}>
                    <View style={styles.petAvatar} />
                    <View style={styles.petInfo}>
                        <Text style={styles.petName}>{pet.name}</Text>
                        <Text style={styles.petDetails}>{pet.breed}</Text>
                        <Text style={styles.petDetails}>{pet.age} years old</Text>
                    </View>
                </View>
            ))}

            <TouchableOpacity style={styles.addButton}>
                <Plus size={24} color="white" />
                <Text style={styles.addButtonText}>Add New Pet</Text>
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
    petCard: {
        flexDirection: 'row',
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
    petAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E5E7EB',
    },
    petInfo: {
        marginLeft: 16,
        justifyContent: 'center',
    },
    petName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    petDetails: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 2,
    },
    addButton: {
        flexDirection: 'row',
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});