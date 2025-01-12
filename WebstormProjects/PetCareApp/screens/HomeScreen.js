import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, Calendar, Activity, Plus } from 'lucide-react-native';
import { usePetContext } from '../context/PetContext';

export function HomeScreen({ navigation }) {
  const { pets, selectedPet, setSelectedPet } = usePetContext();
  const currentPet = pets[selectedPet];

  const getDaysUntil = (dateString) => {
    const diff = new Date(dateString) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <ScrollView style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petSelector}>
        {pets.map((pet, index) => (
          <TouchableOpacity
            key={pet.id}
            style={[
              styles.petButton,
              selectedPet === index && styles.selectedPet
            ]}
            onPress={() => setSelectedPet(index)}
          >
            <View style={styles.petAvatar}>
              <Text style={styles.petInitial}>{pet.name[0]}</Text>
            </View>
            <Text style={styles.petName}>{pet.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.addPetButton}
          onPress={() => navigation.navigate('Pets')}
        >
          <Plus size={24} color="#6b7280" />
        </TouchableOpacity>
      </ScrollView>

      {currentPet.vetVisits?.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Calendar size={24} color="#3b82f6" />
            <Text style={styles.cardTitle}>Next Vet Visit</Text>
          </View>
          <Text style={styles.dateText}>
            {currentPet.vetVisits[0].date} - {currentPet.vetVisits[0].reason}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('Vet')}
          >
            <Text style={styles.addButtonText}>Schedule Visit</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Bell size={24} color="#8b5cf6" />
          <Text style={styles.cardTitle}>Medication Alerts</Text>
        </View>
        {currentPet.medications.map((med) => {
          const daysUntil = getDaysUntil(med.dueDate);
          return (
            <View key={med.id} style={styles.alertItem}>
              <View>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.medFreq}>{med.frequency}</Text>
              </View>
              <Text style={[
                styles.dueText,
                daysUntil <= 2 && styles.urgent
              ]}>
                Due in {daysUntil} days
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Activity size={24} color="#10b981" />
          <Text style={styles.cardTitle}>Health Stats</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Weight</Text>
            <Text style={styles.statValue}>{currentPet.weight} lbs</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Age</Text>
            <Text style={styles.statValue}>{currentPet.age} years</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Breed</Text>
            <Text style={styles.statValue}>{currentPet.breed}</Text>
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
  petSelector: {
    flexGrow: 0,
    paddingVertical: 16,
  },
  petButton: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  selectedPet: {
    opacity: 1,
  },
  petAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  petInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6b7280',
  },
  petName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  addPetButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
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
    color: '#111827',
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  medName: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  medFreq: {
    fontSize: 14,
    color: '#6b7280',
  },
  dueText: {
    fontSize: 14,
    color: '#4b5563',
  },
  urgent: {
    color: '#ef4444',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
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
  addButton: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  addButtonText: {
    color: '#3b82f6',
    fontWeight: '500',
  },
});
