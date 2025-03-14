import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, Button, TextInput, useTheme, Surface, Avatar, SegmentedButtons, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useProfile } from '../../../contexts/ProfileContext';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Define a validation schema for edit profile form
const editProfileSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  height: z.number().positive("Height must be a positive number").optional(),
  weight: z.number().positive("Weight must be a positive number").optional(),
  target_weight: z.number().positive("Target weight must be a positive number").optional(),
  fitness_goal: z.string().optional(),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

export default function EditProfileScreen() {
  const theme = useTheme();
  const { profile, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      height: profile?.height,
      weight: profile?.weight,
      target_weight: profile?.target_weight,
      fitness_goal: profile?.fitness_goal || 'improved-fitness',
    }
  });

  const onSubmit = async (data: EditProfileFormData) => {
    try {
      setSaving(true);
      
      // Update the profile
      await updateProfile(data);
      
      // Show success message
      Alert.alert(
        "Profile Updated",
        "Your profile has been successfully updated.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert("Error", "There was a problem updating your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Get avatar label from name
  const getAvatarLabel = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return 'U';
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <StatusBar style="light" />
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <Text variant="headlineSmall" style={styles.headerTitle}>Edit Profile</Text>
        </View>
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarContainer}>
            <Avatar.Text 
              size={80} 
              label={getAvatarLabel()} 
              style={{ backgroundColor: theme.colors.tertiary }}
            />
          </View>

          <Surface style={styles.formContainer} elevation={1}>
            {/* Full Name */}
            <Controller
              control={control}
              name="full_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Full Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    style={styles.input}
                    error={!!errors.full_name}
                  />
                  {errors.full_name && (
                    <HelperText type="error">{errors.full_name.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Height */}
            <Controller
              control={control}
              name="height"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Height (cm)"
                    value={value?.toString() || ''}
                    onChangeText={(text) => onChange(text ? parseFloat(text) : undefined)}
                    onBlur={onBlur}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.input}
                    error={!!errors.height}
                  />
                  {errors.height && (
                    <HelperText type="error">{errors.height.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Current Weight */}
            <Controller
              control={control}
              name="weight"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Current Weight (kg)"
                    value={value?.toString() || ''}
                    onChangeText={(text) => onChange(text ? parseFloat(text) : undefined)}
                    onBlur={onBlur}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.input}
                    error={!!errors.weight}
                  />
                  {errors.weight && (
                    <HelperText type="error">{errors.weight.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Target Weight */}
            <Controller
              control={control}
              name="target_weight"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Target Weight (kg)"
                    value={value?.toString() || ''}
                    onChangeText={(text) => onChange(text ? parseFloat(text) : undefined)}
                    onBlur={onBlur}
                    mode="outlined"
                    keyboardType="numeric"
                    style={styles.input}
                    error={!!errors.target_weight}
                  />
                  {errors.target_weight && (
                    <HelperText type="error">{errors.target_weight.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Fitness Goal */}
            <View style={styles.inputContainer}>
              <Text variant="bodyMedium" style={styles.label}>Fitness Goal</Text>
              <Controller
                control={control}
                name="fitness_goal"
                render={({ field: { onChange, value } }) => (
                  <View style={{ marginTop: 8 }}>
                    <SegmentedButtons
                      value={value || 'improved-fitness'}
                      onValueChange={onChange}
                      buttons={[
                        { value: 'weight-loss', label: 'Weight Loss' },
                        { value: 'muscle-gain', label: 'Muscle Gain' },
                        { value: 'improved-fitness', label: 'Fitness' },
                      ]}
                    />
                  </View>
                )}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
              <Button 
                mode="outlined" 
                onPress={() => router.back()}
                style={[styles.button, styles.cancelButton]}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={handleSubmit(onSubmit)}
                style={[styles.button, styles.saveButton]}
                loading={saving}
                disabled={saving}
              >
                Save Changes
              </Button>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 4,
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  formContainer: {
    padding: 16,
    borderRadius: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'white',
  },
  label: {
    marginBottom: 8,
    opacity: 0.8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
  },
  cancelButton: {
    marginRight: 8,
  },
  saveButton: {
    marginLeft: 8,
  },
});
