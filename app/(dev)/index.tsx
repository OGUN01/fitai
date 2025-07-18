import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Paragraph, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Dev menu item component
const DevMenuItem = ({ title, description, icon, route }) => {
  const theme = useTheme();
  
  const handlePress = () => {
    router.push(route);
  };
  
  return (
    <TouchableOpacity onPress={handlePress}>
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <MaterialCommunityIcons
            name={icon}
            size={32}
            color={theme.colors.primary}
            style={styles.icon}
          />
          <View style={styles.textContainer}>
            <Title>{title}</Title>
            <Paragraph>{description}</Paragraph>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

export default function DevMenu() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Developer Tools</Text>
      
      <DevMenuItem
        title="Data Debug"
        description="View and fix profile data inconsistencies"
        icon="database-edit"
        route="/(dev)/debug-panel"
      />
      
      <DevMenuItem
        title="API Test"
        description="Test API connections and responses"
        icon="api"
        route="/(dev)/api-test"
      />
      
      <DevMenuItem
        title="Theme Preview"
        description="View all design system components"
        icon="palette"
        route="/(dev)/theme-preview"
      />
      
      <DevMenuItem
        title="Form Tests"
        description="Test form validations and submissions"
        icon="form-select"
        route="/(dev)/form-test"
      />
      
      <DevMenuItem
        title="Onboarding Test"
        description="Test the onboarding flow"
        icon="account-box-outline"
        route="/(dev)/onboarding-test"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  card: {
    marginBottom: 12,
    borderRadius: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
});
