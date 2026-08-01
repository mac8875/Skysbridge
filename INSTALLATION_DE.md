# Skysbridge V39 installieren

1. Das ZIP vollständig entpacken.
2. Sämtliche Dateien und Ordner in das Hauptverzeichnis des GitHub-Repositories hochladen.
3. Vorhandene Dateien ersetzen und den Commit bestätigen.
4. Den Netlify-Deploy abwarten.
5. Die Website einmal neu laden. Bei Bedarf den Browser-Cache leeren.

## Sprachen

- `index.html` ist die englische Startseite.
- `index-de.html` ist die deutsche Startseite.
- Der Umschalter **EN / DE** befindet sich oben rechts auf allen Seiten.
- Auf der Startseite bleibt beim Sprachwechsel der aktuelle Abschnitt erhalten.

## Supabase

Für dieses Sprachupdate ist keine neue SQL-Ausführung erforderlich. Die Admin-Löschfunktion aus V36/V38 bleibt enthalten. Falls `RUN_ONCE_IN_SUPABASE.sql` bereits ausgeführt wurde, muss sie nicht erneut ausgeführt werden.
