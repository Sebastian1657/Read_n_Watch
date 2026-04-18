import { AuthProvider, useAuth } from "@/src/hooks/useAuth";
import { initializeLocalDatabase } from "@/src/store/localDb";
import { initializeStorage } from "@/src/store/mmkv";
import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import "../global.css";

export default function RootLayout() {
  const [isBootstrapReady, setIsBootstrapReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([initializeStorage(), initializeLocalDatabase()])
      .then(() => setIsBootstrapReady(true))
      .catch((error: unknown) => {
        const reason =
          error instanceof Error
            ? error.message
            : "Nieznany blad inicjalizacji pamieci lokalnej.";

        console.error("[bootstrap] initialize failed:", error);
        setStorageError(
          `Nie udalo sie zainicjalizowac pamieci lokalnej.\n${reason}`,
        );
      });
  }, []);

  if (storageError) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.title}>Blad inicjalizacji</Text>
        <Text style={styles.message}>{storageError}</Text>
      </View>
    );
  }

  if (!isBootstrapReady) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.message}>Przygotowywanie pamieci lokalnej...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const segments = useSegments();
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.message}>Odtwarzanie sesji...</Text>
      </View>
    );
  }

  const inAuthGroup = segments[0] === "(auth)";

  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (session && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#666666",
  },
});
