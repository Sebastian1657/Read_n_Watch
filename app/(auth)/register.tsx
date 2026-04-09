import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Read n Watch</Text>
      <Text style={styles.title}>Rejestracja</Text>
      <Text style={styles.description}>
        Ekran rejestracji został wydzielony do osobnej grupy tras i czeka na
        integrację z Supabase.
      </Text>

      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Wróć do logowania</Text>
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
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
