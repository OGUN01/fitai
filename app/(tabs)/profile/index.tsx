import React from 'react';
import { View, StyleSheet, ScrollView, Alert, ToastAndroid, Platform, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Text, Card, List, Switch, Avatar, Button, useTheme, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../../contexts/AuthContext';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import supabase from '../../../lib/supabase';
import { useProfile } from '../../../contexts/ProfileContext';
import { format } from 'date-fns';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks
    
    setIsLoggingOut(true);
    try {
      console.log('Profile screen: Starting logout process');
      // Force navigation first
      router.replace('/(auth)/login');
      // Then sign out from Supabase
      await signOut();
      console.log('Profile screen: Logout completed');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'An error occurred while logging out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDirectLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'An error occurred while logging out. Please try again.');
    }
  };

  // Get avatar label from name or email
  const getAvatarLabel = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Format fitness goal text
  const formatFitnessGoal = (goal?: string) => {
    if (!goal) return 'Not set';
    return goal.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" />
      
      {/* Header with Bold Minimalism design */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text variant="headlineMedium" style={styles.headerTitle}>Profile</Text>
          </View>
        </LinearGradient>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header with Bold Minimalism design */}
        <LinearGradient
          colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.profileHeaderGradient}
        >
          <View style={styles.profileHeader}>
            <Avatar.Text 
              size={80} 
              label={getAvatarLabel()} 
              style={styles.profileAvatar}
            />
            <Text variant="headlineSmall" style={styles.userName}>
              {profile?.full_name || (user?.email ? user.email.split('@')[0] : 'User')}
            </Text>
            <Text variant="bodyMedium" style={styles.userDetails}>
              {user?.email || 'No email available'}
            </Text>
            <TouchableOpacity 
              style={styles.editButtonContainer}
              onPress={() => router.push('/(tabs)/profile/edit-profile')}
            >
              <LinearGradient 
                colors={[theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.editButtonGradient}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        
        <Card style={styles.card} mode="outlined">
          <LinearGradient
            colors={['#ffffff', '#f8f8f8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <Card.Content>
              <View style={styles.cardHeaderRow}>
                <MaterialCommunityIcons name="target" size={24} color={theme.colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>Fitness Goals</Text>
              </View>
              
              <List.Item
                title="Primary Goal"
                description={formatFitnessGoal(profile?.fitness_goal)}
                left={props => <List.Icon {...props} icon="target" color={theme.colors.primary} />}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Current Weight"
                description={profile?.weight ? `${profile.weight} kg` : 'Not set'}
                left={props => <List.Icon {...props} icon="scale" color={theme.colors.primary} />}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Target Weight"
                description={profile?.target_weight ? `${profile.target_weight} kg` : 'Not set'}
                left={props => <List.Icon {...props} icon="scale-balance" color={theme.colors.primary} />}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Height"
                description={profile?.height ? `${profile.height} cm` : 'Not set'}
                left={props => <List.Icon {...props} icon="human-male-height" color={theme.colors.primary} />}
                style={styles.listItem}
              />
            </Card.Content>
          </LinearGradient>
        </Card>
        
        <Card style={styles.card} mode="outlined">
          <LinearGradient
            colors={['#ffffff', '#f8f8f8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <Card.Content>
              <View style={styles.cardHeaderRow}>
                <MaterialCommunityIcons name="cog" size={24} color={theme.colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>Preferences</Text>
              </View>
              
              <List.Item
                title="Workout Notifications"
                style={styles.listItem}
                right={() => (
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    color={theme.colors.primary}
                  />
                )}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Meal Reminders"
                style={styles.listItem}
                right={() => (
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    color={theme.colors.primary}
                  />
                )}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Dark Mode"
                style={styles.listItem}
                right={() => (
                  <Switch
                    value={darkModeEnabled}
                    onValueChange={setDarkModeEnabled}
                    color={theme.colors.primary}
                  />
                )}
              />
            </Card.Content>
          </LinearGradient>
        </Card>
        
        <Card style={styles.card} mode="outlined">
          <LinearGradient
            colors={['#ffffff', '#f8f8f8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <Card.Content>
              <View style={styles.cardHeaderRow}>
                <MaterialCommunityIcons name="cog-outline" size={24} color={theme.colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>App Settings</Text>
              </View>
              
              <List.Item
                title="Account"
                description="Manage your account details"
                left={props => <List.Icon {...props} icon="account" color={theme.colors.primary} />}
                onPress={() => console.log('Navigate to account settings')}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Privacy"
                description="Manage your privacy settings"
                left={props => <List.Icon {...props} icon="shield-account" color={theme.colors.primary} />}
                onPress={() => console.log('Navigate to privacy settings')}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Help & Support"
                description="Contact us for assistance"
                left={props => <List.Icon {...props} icon="help-circle" color={theme.colors.primary} />}
                onPress={() => console.log('Navigate to help & support')}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="About"
                description="App version 1.0.0"
                left={props => <List.Icon {...props} icon="information" color={theme.colors.primary} />}
                onPress={() => console.log('Navigate to about page')}
                style={styles.listItem}
              />
            </Card.Content>
          </LinearGradient>
        </Card>
        
        <Card style={[styles.card, { marginTop: 16 }]} mode="outlined">
          <LinearGradient
            colors={['#ffffff', '#f8f8f8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <Card.Content>
              <View style={styles.cardHeaderRow}>
                <MaterialCommunityIcons name="account-outline" size={24} color={theme.colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>Account</Text>
              </View>
              
              <List.Item
                title="Email"
                description={user?.email || 'Not available'}
                left={props => <List.Icon {...props} icon="email" color={theme.colors.primary} />}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Member Since"
                description={user?.created_at ? format(new Date(user.created_at), 'MMM dd, yyyy') : 'Not available'}
                left={props => <List.Icon {...props} icon="calendar" color={theme.colors.primary} />}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <List.Item
                title="Data & Privacy"
                description="Manage your data and privacy settings"
                left={props => <List.Icon {...props} icon="lock" color={theme.colors.primary} />}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              
              <TouchableOpacity onPress={handleLogout} disabled={isLoggingOut}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.logoutButtonGradient}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <View style={styles.logoutButtonContent}>
                      <MaterialCommunityIcons name="logout" size={18} color="white" />
                      <Text style={styles.logoutButtonText}>Log Out</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Card.Content>
          </LinearGradient>
        </Card>

        <Button 
          mode="outlined" 
          style={styles.logoutButton}
          textColor="#F44336"
          onPress={handleLogout}
          loading={isLoggingOut}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Logging out...' : 'Log Out'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  headerGradient: {
    flex: 1,
    borderRadius: 10,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  profileHeaderGradient: {
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  profileHeader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatar: {
    marginBottom: 8,
  },
  userName: {
    marginTop: 12,
    fontWeight: 'bold',
  },
  userDetails: {
    opacity: 0.7,
    marginTop: 4,
  },
  editButtonContainer: {
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  editButtonGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 16,
    borderRadius: 10,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cardGradient: {
    flex: 1,
    borderRadius: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listItem: {
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 4,
  },
  logoutButton: {
    marginTop: 8,
    marginBottom: 24,
    borderColor: '#F44336',
  },
  logoutButtonGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
