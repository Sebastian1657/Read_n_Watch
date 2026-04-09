import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Read n Watch</Text>
      <Text style={styles.title}>Logowanie</Text>
      <Text style={styles.description}>
        Ekran logowania jest już przygotowany jako osobna trasa w grupie auth.
      </Text>

      <Link href="/(auth)/register" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Przejdź do rejestracji</Text>
        </Pressable>
      </Link>

      <Link href="/(tabs)" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Przejdź do aplikacji</Text>
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
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 12,
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
});
