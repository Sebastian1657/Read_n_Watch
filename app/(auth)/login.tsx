import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "@/src/api/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage("Podaj adres e-mail i haslo.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Read n Watch</Text>
      <Text style={styles.title}>Logowanie</Text>
      <Text style={styles.description}>
        Zaloguj sie, aby sprawdzic utrzymywanie sesji Supabase w zaszyfrowanym
        MMKV.
      </Text>

      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="E-mail"
        placeholderTextColor="#9AA4B2"
        style={styles.input}
        value={email}
      />

      <TextInput
        autoCapitalize="none"
        onChangeText={setPassword}
        placeholder="Haslo"
        placeholderTextColor="#9AA4B2"
        secureTextEntry
        style={styles.input}
        value={password}
      />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        disabled={isSubmitting}
        onPress={handleLogin}
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Zaloguj sie</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Przejdz do rejestracji</Text>
        </Pressable>
      </Link>
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
  eyebrow: {
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#007AFF",
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#666666",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D0D7DE",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111111",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 12,
    minHeight: 52,
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
    textAlign: "center",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#D0D7DE",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
    marginBottom: 12,
  },
});
