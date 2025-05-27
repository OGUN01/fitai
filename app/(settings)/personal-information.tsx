import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TextInput, Text, useTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import StyledText from '../../components/ui/StyledText';

export default function PersonalInformationScreen() {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  
  // Form state
  const [name, setName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() || '');
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [age, setAge] = useState(profile?.age?.toString() || '');
  const [loading, setLoading] = useState(false);
  
  // Populate form values when profile is loaded
  useEffect(() => {
    if (profile) {
      setName(profile.full_name || '');
      setHeight(profile.height_cm?.toString() || '');
      setWeight(profile.weight_kg?.toString() || '');
      setGender(profile.gender || '');
      setAge(profile.age?.toString() || '');
    }
    
    if (user) {
      setEmail(user.email || '');
    }
  }, [profile, user]);
  
  // Handle save
  const handleSave = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLoading(true);
      
      // Validate form
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        setLoading(false);
        return;
      }
      
      // Convert numeric values
      const numHeight = parseFloat(height);
      const numWeight = parseFloat(weight);
      const numAge = parseInt(age, 10);
      
      // Prepare update
      const updatedProfile = {
        ...profile,
        full_name: name.trim(),
        height_cm: isNaN(numHeight) ? undefined : numHeight,
        weight_kg: isNaN(numWeight) ? undefined : numWeight,
        age: isNaN(numAge) ? undefined : numAge,
        gender: gender || undefined
      };
      
      // Update profile
      await updateProfile(updatedProfile);
      
      Alert.alert(
        'Success',
        'Your profile has been updated',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <StyledText variant="headingMedium" style={styles.headerTitle}>
          Personal Information
        </StyledText>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <StyledText variant="bodyMedium" style={styles.sectionTitle}>Basic Information</StyledText>
          
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            mode="outlined"
            outlineColor="rgba(255, 255, 255, 0.2)"
            activeOutlineColor="#FF4B81"
            textColor="white"
            theme={{ colors: { onSurfaceVariant: 'rgba(255, 255, 255, 0.6)' } }}
          />
          
          <TextInput
            label="Email"
            value={email}
            editable={false}
            style={[styles.input, { opacity: 0.7 }]}
            mode="outlined"
            outlineColor="rgba(255, 255, 255, 0.2)"
            activeOutlineColor="#FF4B81"
            textColor="white"
            theme={{ colors: { onSurfaceVariant: 'rgba(255, 255, 255, 0.6)' } }}
          />
          
          <StyledText variant="bodySmall" style={styles.infoText}>
            Email cannot be changed. Contact support for assistance.
          </StyledText>
        </View>
        
        <View style={styles.section}>
          <StyledText variant="bodyMedium" style={styles.sectionTitle}>Body Metrics</StyledText>
          
          <View style={styles.row}>
            <TextInput
              label="Height (cm)"
              value={height}
              onChangeText={setHeight}
              style={[styles.input, { flex: 1, marginRight: 10 }]}
              mode="outlined"
              outlineColor="rgba(255, 255, 255, 0.2)"
              activeOutlineColor="#FF4B81"
              textColor="white"
              keyboardType="numeric"
              theme={{ colors: { onSurfaceVariant: 'rgba(255, 255, 255, 0.6)' } }}
            />
            
            <TextInput
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              style={[styles.input, { flex: 1 }]}
              mode="outlined"
              outlineColor="rgba(255, 255, 255, 0.2)"
              activeOutlineColor="#FF4B81"
              textColor="white"
              keyboardType="numeric"
              theme={{ colors: { onSurfaceVariant: 'rgba(255, 255, 255, 0.6)' } }}
            />
          </View>
          
          <View style={styles.row}>
            <TextInput
              label="Age"
              value={age}
              onChangeText={setAge}
              style={[styles.input, { flex: 1, marginRight: 10 }]}
              mode="outlined"
              outlineColor="rgba(255, 255, 255, 0.2)"
              activeOutlineColor="#FF4B81"
              textColor="white"
              keyboardType="numeric"
              theme={{ colors: { onSurfaceVariant: 'rgba(255, 255, 255, 0.6)' } }}
            />
            
            <TextInput
              label="Gender"
              value={gender}
              onChangeText={setGender}
              style={[styles.input, { flex: 1 }]}
              mode="outlined"
              outlineColor="rgba(255, 255, 255, 0.2)"
              activeOutlineColor="#FF4B81"
              textColor="white"
              theme={{ colors: { onSurfaceVariant: 'rgba(255, 255, 255, 0.6)' } }}
            />
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          <LinearGradient
            colors={['#FF4B81', '#FF6B4B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            {loading ? (
              <StyledText variant="bodyMedium" style={styles.saveButtonText}>Saving...</StyledText>
            ) : (
              <StyledText variant="bodyMedium" style={styles.saveButtonText}>Save Changes</StyledText>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121232',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(20, 20, 50, 0.8)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'rgba(30, 30, 60, 0.6)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
