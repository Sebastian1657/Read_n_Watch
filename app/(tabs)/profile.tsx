import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/src/api/supabase";
import { useAuth } from "@/src/hooks/useAuth";

export default function ProfileScreen() {
  const { session } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Konto</Text>
      <Text style={styles.description}>
        Zalogowany uzytkownik: {session?.user.email ?? "brak"}
      </Text>
      <Text style={styles.description}>
        Po restarcie aplikacji ten ekran powinien nadal pokazywac aktywna sesje.
      </Text>

      <Pressable
        disabled={isSigningOut}
        onPress={handleSignOut}
        style={[styles.button, isSigningOut && styles.buttonDisabled]}
      >
        {isSigningOut ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Wyloguj sie</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#666666",
    marginBottom: 12,
  },
  button: {
    marginTop: 16,
    backgroundColor: "#111111",
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
