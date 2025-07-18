import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Alert
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

// Define the photo type based on our Gemini implementation
interface BodyPhoto {
  uri: string;
  type: 'front' | 'side' | 'back';
}

interface Props {
  onSubmit: (photos: BodyPhoto[]) => void;
  isLoading: boolean;
}

export default function BodyAnalysisForm({ onSubmit, isLoading }: Props) {
  const [photos, setPhotos] = useState<BodyPhoto[]>([]);

  // Request camera permissions
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to make this work!'
        );
        return false;
      }
      return true;
    }
    return true;
  };

  // Handle image selection for a specific photo type
  const selectImage = async (type: 'front' | 'side' | 'back') => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        // Handle file size check based on platform
        if (Platform.OS === 'web') {
          // On web, we can't use FileSystem.getInfoAsync, so we'll skip the size check
          // or implement a web-specific size check if needed
          setPhotos(prevPhotos => {
            const newPhotos = prevPhotos.filter(p => p.type !== type);
            return [...newPhotos, { uri: selectedAsset.uri, type }];
          });
        } else {
          // Native platforms can use FileSystem
          try {
            // Check if the file is within a reasonable size (5MB)
            const fileInfo = await FileSystem.getInfoAsync(selectedAsset.uri);

            // Check if fileInfo exists and has the size property (with proper type checking)
            const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

            if (fileSize > 5 * 1024 * 1024) {
              Alert.alert(
                'File Too Large',
                'Please select an image less than 5MB in size'
              );
              return;
            }

            setPhotos(prevPhotos => {
              const newPhotos = prevPhotos.filter(p => p.type !== type);
              return [...newPhotos, { uri: selectedAsset.uri, type }];
            });
          } catch (error) {
            console.error('Error checking file size:', error);
            // If checking file size fails, still allow the image to be used
            setPhotos(prevPhotos => {
              const newPhotos = prevPhotos.filter(p => p.type !== type);
              return [...newPhotos, { uri: selectedAsset.uri, type }];
            });
          }
        }
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Remove a photo from the selection
  const removePhoto = (type: 'front' | 'side' | 'back') => {
    setPhotos(prevPhotos => prevPhotos.filter(p => p.type !== type));
  };

  // Find a specific photo by type
  const getPhotoByType = (type: 'front' | 'side' | 'back') => {
    return photos.find(p => p.type === type);
  };

  // Button disabled state
  const isSubmitDisabled = photos.length === 0 || isLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.instructions}>
        Select body photos for AI analysis. For best results, include front, side, and back views.
      </Text>
      
      <View style={styles.photoGrid}>
        {/* Front Photo */}
        <PhotoSelector
          type="front"
          photo={getPhotoByType('front')}
          onSelect={() => selectImage('front')}
          onRemove={() => removePhoto('front')}
        />
        
        {/* Side Photo */}
        <PhotoSelector
          type="side"
          photo={getPhotoByType('side')}
          onSelect={() => selectImage('side')}
          onRemove={() => removePhoto('side')}
        />
        
        {/* Back Photo */}
        <PhotoSelector
          type="back"
          photo={getPhotoByType('back')}
          onSelect={() => selectImage('back')}
          onRemove={() => removePhoto('back')}
        />
      </View>
      
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Note: Photos are only used for testing AI analysis and are not stored permanently.
          Analysis is performed locally on your device.
        </Text>
      </View>
      
      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          isSubmitDisabled && styles.submitButtonDisabled
        ]}
        onPress={() => onSubmit(photos)}
        disabled={isSubmitDisabled}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? "Analyzing..." : "Analyze Body Composition"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Photo selector component
function PhotoSelector({ 
  type, 
  photo, 
  onSelect, 
  onRemove 
}: { 
  type: 'front' | 'side' | 'back'; 
  photo?: BodyPhoto; 
  onSelect: () => void; 
  onRemove: () => void; 
}) {
  return (
    <View style={styles.photoContainer}>
      <Text style={styles.photoLabel}>{type.charAt(0).toUpperCase() + type.slice(1)} View</Text>
      
      {photo ? (
        <View style={styles.photoWrapper}>
          <Image source={{ uri: photo.uri }} style={styles.photo} />
          <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
            <Text style={styles.removeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addPhotoButton} onPress={onSelect}>
          <Text style={styles.addPhotoButtonText}>+ Add Photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  instructions: {
    fontSize: 16,
    lineHeight: 22,
    color: "#334155",
    marginBottom: 16,
  },
  photoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  photoContainer: {
    width: "30%",
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    color: "#334155",
    textAlign: "center",
  },
  photoWrapper: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    aspectRatio: 3/4,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  addPhotoButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 3/4,
    backgroundColor: "#f8fafc",
  },
  addPhotoButtonText: {
    color: "#64748b",
    fontSize: 14,
  },
  disclaimer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  submitButton: {
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "#fcd34d",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
