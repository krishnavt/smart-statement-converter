cat << 'EOF' > context/PetContext.js
import React, { createContext, useState, useContext } from 'react';

const PetContext = createContext();

export function PetProvider({ children }) {
    const [pets, setPets] = useState([
        {
            id: 1,
            name: 'Max',
            species: 'Dog',
            breed: 'Golden Retriever',
            weight: 65,
            age: 3,
            image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=300&auto=format&fit=crop',
            medications: [
                { id: 1, name: 'Heartworm Prevention', dueDate: '2024-01-14', frequency: 'Monthly' },
                { id: 2, name: 'Flea Treatment', dueDate: '2024-01-27', frequency: 'Monthly' }
            ],
            vetVisits: [
                { id: 1, date: '2025-02-15', reason: 'Annual Checkup', notes: 'Vaccination due' }
            ]
        },
        {
            id: 2,
            name: 'Luna',
            species: 'Cat',
            breed: 'Siamese',
            weight: 8,
            age: 2,
            image: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?q=80&w=300&auto=format&fit=crop',
            medications: [
                { id: 1, name: 'Flea Treatment', dueDate: '2024-01-20', frequency: 'Monthly' }
            ],
            vetVisits: [
                { id: 1, date: '2025-03-01', reason: 'Dental Cleaning', notes: 'Regular checkup' }
            ]
        }
    ]);

  const [selectedPet, setSelectedPet] = useState(0);

  const addPet = (newPet) => {
    setPets([...pets, { ...newPet, id: pets.length + 1 }]);
  };

  const updatePet = (id, updatedPet) => {
    setPets(pets.map(pet => pet.id === id ? { ...pet, ...updatedPet } : pet));
  };

  const addMedication = (petId, medication) => {
    setPets(pets.map(pet => {
      if (pet.id === petId) {
        return {
          ...pet,
          medications: [...pet.medications, { ...medication, id: pet.medications.length + 1 }]
        };
      }
      return pet;
    }));
  };

  const addVetVisit = (petId, visit) => {
    setPets(pets.map(pet => {
      if (pet.id === petId) {
        return {
          ...pet,
          vetVisits: [...pet.vetVisits, { ...visit, id: pet.vetVisits.length + 1 }]
        };
      }
      return pet;
    }));
  };

  return (
    <PetContext.Provider value={{
      pets,
      selectedPet,
      setSelectedPet,
      addPet,
      updatePet,
      addMedication,
      addVetVisit
    }}>
      {children}
    </PetContext.Provider>
  );
}

export const usePetContext = () => useContext(PetContext);
