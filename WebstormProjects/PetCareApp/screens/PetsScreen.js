import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Plus } from 'lucide-react-native';
import { usePetContext } from '../context/PetContext';

export function PetsScreen() {
  const { pets, addPet } = usePetContext();
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [newPet, setNewPet] = useState({
    name: '',
    species: '',
    breed: '',
    weight: '',
    age: '',
  });

  const handleAddPet = () => {
    if (newPet.name && newPet.species) {
      addPet({
        ...newPet,
        weight: parseFloat(newPet.weight),
        age: parseInt(newPet.age),
        medications: [],
        vetVisits: [],
      });
      setNewPet({ name: '', species: '', breed: '', weight: '', age: '' });
      setIsAddingPet(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {pets.map(pet => (
        <View key={pet.id} style={styles.petCard}>
          <View style={styles.petAvatar}>
            <Text style={styles.petInitial}>{pet.name[0]}</Text>
          </View>
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{pet.name}</Text>
            <Text style={styles.petDetails}>{pet.breed}</Text>
            <Text style={styles.petDetails}>{pet.age} years • {pet.weight} lbs</Text>
          </View>
        </View>
      ))}

      {!isAddingPet ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddingPet(true)}
        >
          <Plus size={24} color="white" />
          <Text style={styles.addButtonText}>Add New Pet</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addPetForm}>
          <Text style={styles.formTitle}>Add New Pet</Text>
          <TextInput
            style={styles.input}
            placeholder="Pet Name"
            value={newPet.name}
            onChangeText={(text) => setNewPet({ ...newPet, name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Species (Dog, Cat, etc.)"
            value={newPet.species}
            onChangeText={(text) => setNewPet({ ...newPet, species: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Breed"
            value={newPet.breed}
            onChangeText={(text) => setNewPet({ ...newPet, breed: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Weight (lbs)"
            value={newPet.weight}
            onChangeText={(text) => setNewPet({ ...newPet, weight: text })}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Age (years)"
            value={newPet.age}
            onChangeText={(text) => setNewPet({ ...newPet, age: text })}
            keyboardType="numeric"
          />
          <View style={styles.formButtons}>
            <TouchableOpacity 
              style={[styles.formButton, styles.cancelButton]}
              onPress={() => setIsAddingPet(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.formButton, styles.saveButton]}
              onPress={handleAddPet}
            >
              <Text style={styles.saveButtonText}>Save Pet</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6b7280',
  },
  petInfo: {
    marginLeft: 16,
    flex: 1,
  },
  petName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
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
  addPetForm: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});
