import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function DevTools() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Developer Tools</Text>
      <Text style={styles.subtitle}>Use these tools for development and testing</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.push("/(dev)/ai-test-harness")}
        >
          <Text style={styles.buttonText}>AI Services Test Harness</Text>
          <Text style={styles.buttonDescription}>
            Test AI services with different parameters and view results
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    backgroundColor: "#f59e0b",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  buttonDescription: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.8,
  },
});
