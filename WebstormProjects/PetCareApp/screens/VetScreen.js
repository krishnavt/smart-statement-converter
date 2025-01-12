import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Calendar, Phone, MapPin, Clock } from 'lucide-react-native';
import { usePetContext } from '../context/PetContext';

export function VetScreen() {
  const { pets, selectedPet, addVetVisit } = usePetContext();
  const currentPet = pets[selectedPet];
  const [isScheduling, setIsScheduling] = useState(false);
  const [newVisit, setNewVisit] = useState({
    date: '',
    reason: '',
    notes: '',
  });

  const vetInfo = {
    name: 'Dr. Sarah Wilson',
    clinic: 'Healthy Paws Veterinary',
    phone: '(555) 123-4567',
    address: '123 Pet Care Lane',
    hours: 'Mon-Fri 8am-6pm',
  };

  const handleAddVisit = () => {
    if (newVisit.date && newVisit.reason) {
      addVetVisit(currentPet.id, newVisit);
      setNewVisit({ date: '', reason: '', notes: '' });
      setIsScheduling(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.vetName}>{vetInfo.name}</Text>
        <Text style={styles.clinicName}>{vetInfo.clinic}</Text>
        
        <View style={styles.infoRow}>
          <Phone size={20} color="#6b7280" />
          <Text style={styles.infoText}>{vetInfo.phone}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <MapPin size={20} color="#6b7280" />
          <Text style={styles.infoText}>{vetInfo.address}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Clock size={20} color="#6b7280" />
          <Text style={styles.infoText}>{vetInfo.hours}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Upcoming Visits</Text>
        {currentPet.vetVisits.map(visit => (
          <View key={visit.id} style={styles.visitItem}>
            <View style={styles.visitHeader}>
              <Calendar size={20} color="#3b82f6" />
              <Text style={styles.visitDate}>{visit.date}</Text>
            </View>
            <Text style={styles.visitReason}>{visit.reason}</Text>
            {visit.notes && <Text style={styles.visitNotes}>{visit.notes}</Text>}
          </View>
        ))}
      </View>

      {!isScheduling ? (
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => setIsScheduling(true)}
        >
          <Text style={styles.scheduleButtonText}>Schedule New Visit</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.scheduleForm}>
          <Text style={styles.formTitle}>Schedule Visit</Text>
          <TextInput
            style={styles.input}
            placeholder="Date (YYYY-MM-DD)"
            value={newVisit.date}
            onChangeText={(text) => setNewVisit({ ...newVisit, date: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Reason for Visit"
            value={newVisit.reason}
            onChangeText={(text) => setNewVisit({ ...newVisit, reason: text })}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Additional Notes"
            value={newVisit.notes}
            onChangeText={(text) => setNewVisit({ ...newVisit, notes: text })}
            multiline
          />
          <View style={styles.formButtons}>
            <TouchableOpacity 
              style={[styles.formButton, styles.cancelButton]}
              onPress={() => setIsScheduling(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.formButton, styles.saveButton]}
              onPress={handleAddVisit}
            >
              <Text style={styles.saveButtonText}>Schedule</Text>
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
  vetName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  clinicName: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4b5563',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  visitItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  visitDate: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  visitReason: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 4,
  },
  visitNotes: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  scheduleButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleForm: {
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
