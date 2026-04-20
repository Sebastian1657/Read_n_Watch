import React from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import {
    BookItem,
    BooksApiError,
    getTrendingBooks,
} from "@/src/api/booksService";

export default function HomeScreen() {
  const [book, setBook] = React.useState<BookItem | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadRandomBook = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const randomPage = Math.floor(Math.random() * 5);
      const response = await getTrendingBooks({
        startIndex: randomPage * 20,
        maxResults: 20,
      });
      const candidates = Array.isArray(response.data) ? response.data : [];

      if (candidates.length === 0) {
        throw new Error("Brak książek w odpowiedzi API.");
      }

      const randomIndex = Math.floor(Math.random() * candidates.length);
      setBook(candidates[randomIndex]);
    } catch (err) {
      const fallbackMessage = "Nie udało się pobrać losowej książki.";

      if (err instanceof BooksApiError) {
        setError(`${fallbackMessage} (HTTP ${err.status})`);
      } else if (err instanceof Error && err.message) {
        setError(`${fallbackMessage} ${err.message}`);
      } else {
        setError(fallbackMessage);
      }

      setBook(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRandomBook();
  }, [loadRandomBook]);

  const coverUrl = book?.coverUrl ?? book?.thumbnail ?? book?.smallThumbnail;
  const firstAuthor = book?.authors?.[0] ?? "Autor nieznany";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Losowa książka (test Google Books API)</Text>

      <View style={styles.card}>
        {isLoading ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator size="large" color="#1f6feb" />
            <Text style={styles.loadingText}>Pobieram książkę...</Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {!isLoading && !error && book ? (
          <>
            {coverUrl ? (
              <Image
                source={{ uri: coverUrl }}
                style={styles.poster}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Text style={styles.posterFallbackText}>Brak okładki</Text>
              </View>
            )}

            <Text style={styles.movieTitle}>{book.title}</Text>
            <Text style={styles.movieYear}>
              {firstAuthor}
              {book.year ? ` • ${book.year}` : ""}
            </Text>
          </>
        ) : null}

        <Pressable
          onPress={() => {
            void loadRandomBook();
          }}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.button,
            pressed && !isLoading ? styles.buttonPressed : null,
            isLoading ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.buttonText}>Wylosuj ponownie</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#f4f7fb",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 14,
    color: "#101828",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  centeredBlock: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#475467",
  },
  errorText: {
    color: "#b42318",
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  poster: {
    width: "100%",
    height: 260,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
    marginBottom: 12,
  },
  posterFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  posterFallbackText: {
    color: "#667085",
  },
  movieTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  movieYear: {
    fontSize: 14,
    color: "#475467",
    marginBottom: 14,
  },
  button: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: "#1f6feb",
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
