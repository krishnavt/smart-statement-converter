# Pet Care App

A React Native mobile application for managing pet care, including vet visits, medications, and health tracking.

## Features

- Pet wellness dashboard
- Medication tracking and alerts
- Vet appointment management
- Pet health statistics
- Multiple pet profiles

## Prerequisites

Before you begin, ensure you have installed:
- Node.js (version 18 or higher)
- npm (Node Package Manager)
- Expo Go app on your iOS device

## Installation

1. Clone the repository:
```bash
git clone https://github.com/krishnavt/PetCareApp.git
cd PetCareApp
npm install

npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install lucide-react-native

npx expo start

PetCareApp/
├── App.js                # Main application file with navigation setup
├── screens/              # Screen components
│   ├── HomeScreen.js     # Dashboard screen with pet wellness info
│   ├── PetsScreen.js     # Pets management screen
│   ├── VetScreen.js      # Vet information and appointments
│   └── AlertsScreen.js   # Medication and appointment alerts
├── assets/               # Images and assets
└── package.json          # Project dependencies