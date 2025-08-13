import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Card, Title, Avatar, Button, Surface, Switch, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useUserStore } from '../store/userStore';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { currentUser, updateUser } = useUserStore();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);

  const handleEditProfile = () => {
    // Navigate to profile editing screen
    navigation.navigate('EditProfile');
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'This feature will export all your expense data to a CSV file.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => console.log('Exporting data...') }
      ]
    );
  };

  const handleBackupData = () => {
    Alert.alert(
      'Backup Data',
      'Your data will be backed up to your cloud storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Backup', onPress: () => console.log('Backing up data...') }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Deleting account...') }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => console.log('Logging out...') }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Section */}
        <Surface style={styles.profileSection}>
          <View style={styles.profileContent}>
            <Avatar.Text 
              size={80} 
              label={currentUser?.name?.charAt(0) || 'U'} 
              style={styles.profileAvatar}
            />
            <View style={styles.profileInfo}>
              <Title style={styles.profileName}>
                {currentUser?.name || 'User'}
              </Title>
              <List.Item
                title={currentUser?.email || 'No email set'}
                titleStyle={styles.profileEmail}
                left={() => <Ionicons name="mail-outline" size={20} color="#666" />}
              />
              {currentUser?.phone && (
                <List.Item
                  title={currentUser.phone}
                  titleStyle={styles.profilePhone}
                  left={() => <Ionicons name="call-outline" size={20} color="#666" />}
                />
              )}
            </View>
          </View>
          <Button 
            mode="outlined" 
            onPress={handleEditProfile}
            style={styles.editButton}
          >
            Edit Profile
          </Button>
        </Surface>

        {/* Preferences Section */}
        <Card style={styles.settingsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Preferences</Title>
            
            <List.Item
              title="Push Notifications"
              description="Receive notifications for new expenses and settlements"
              left={() => <Ionicons name="notifications-outline" size={24} color="#666" />}
              right={() => (
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                />
              )}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Dark Mode"
              description="Use dark theme throughout the app"
              left={() => <Ionicons name="moon-outline" size={24} color="#666" />}
              right={() => (
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                />
              )}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Auto Backup"
              description="Automatically backup your data to the cloud"
              left={() => <Ionicons name="cloud-upload-outline" size={24} color="#666" />}
              right={() => (
                <Switch
                  value={autoBackup}
                  onValueChange={setAutoBackup}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Data & Privacy Section */}
        <Card style={styles.settingsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Data & Privacy</Title>
            
            <List.Item
              title="Export Data"
              description="Download your expense data as CSV"
              left={() => <Ionicons name="download-outline" size={24} color="#666" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={handleExportData}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Backup Data"
              description="Manually backup your data"
              left={() => <Ionicons name="save-outline" size={24} color="#666" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={handleBackupData}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Privacy Policy"
              description="View our privacy policy"
              left={() => <Ionicons name="shield-outline" size={24} color="#666" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={() => console.log('Open privacy policy')}
            />
          </Card.Content>
        </Card>

        {/* Support Section */}
        <Card style={styles.settingsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Support</Title>
            
            <List.Item
              title="Help & FAQ"
              description="Get help and view frequently asked questions"
              left={() => <Ionicons name="help-circle-outline" size={24} color="#666" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={() => console.log('Open help')}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Contact Support"
              description="Get in touch with our support team"
              left={() => <Ionicons name="chatbubble-outline" size={24} color="#666" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={() => console.log('Contact support')}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Rate App"
              description="Rate us on the App Store"
              left={() => <Ionicons name="star-outline" size={24} color="#666" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={() => console.log('Rate app')}
            />
          </Card.Content>
        </Card>

        {/* About Section */}
        <Card style={styles.settingsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>About</Title>
            
            <List.Item
              title="Version"
              description="1.0.0 (Build 1)"
              left={() => <Ionicons name="information-circle-outline" size={24} color="#666" />}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Terms of Service"
              description="View our terms of service"
              left={() => <Ionicons name="document-text-outline" size={24} color="#666" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={() => console.log('Open terms')}
            />
          </Card.Content>
        </Card>

        {/* Danger Zone */}
        <Card style={[styles.settingsCard, styles.dangerCard]}>
          <Card.Content>
            <Title style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Title>
            
            <List.Item
              title="Logout"
              description="Sign out of your account"
              titleStyle={styles.dangerText}
              left={() => <Ionicons name="log-out-outline" size={24} color="#F44336" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={handleLogout}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Delete Account"
              description="Permanently delete your account and all data"
              titleStyle={styles.dangerText}
              left={() => <Ionicons name="trash-outline" size={24} color="#F44336" />}
              right={() => <Ionicons name="chevron-forward" size={20} color="#ccc" />}
              onPress={handleDeleteAccount}
            />
          </Card.Content>
        </Card>

        <View style={styles.footer} />
      </ScrollView>
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
  profileSection: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    backgroundColor: '#6200EE',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
  },
  profilePhone: {
    fontSize: 16,
    color: '#666',
  },
  editButton: {
    alignSelf: 'flex-start',
  },
  settingsCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 4,
  },
  dangerCard: {
    borderColor: '#FFEBEE',
    borderWidth: 1,
  },
  dangerTitle: {
    color: '#F44336',
  },
  dangerText: {
    color: '#F44336',
  },
  footer: {
    height: 32,
  },
});