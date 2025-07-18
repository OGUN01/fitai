import { Stack } from "expo-router";
import { View, Text } from "react-native";

export default function DevLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#f59e0b",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "Developer Tools",
          }}
        />
        <Stack.Screen
          name="ai-test-harness"
          options={{
            title: "AI Services Test Harness",
          }}
        />
      </Stack>
    </>
  );
}
