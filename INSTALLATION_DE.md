# Skysbridge V36 – veröffentlichte Sterne als Administrator löschen

Diese Version basiert auf dem aktuellen V35-Stand der Website. Die Löschfunktion ist direkt in `js/app.js` integriert; das alte Zusatzskript `admin-star-delete.js` wird nicht mehr benötigt.

## Was geändert wurde

- Im Administratorbereich gibt es eine vierte Karte: **Published stars**.
- Alle freigegebenen und öffentlich sichtbaren Memorial-Sterne werden dort geladen.
- Ein Administrator kann einen Stern nach einer Sicherheitsabfrage dauerhaft löschen.
- Sky bleibt geschützt: Sein erster Stern ist fest in der Website eingebaut und erscheint nicht in der Löschliste.
- Die Löschung nutzt bevorzugt eine abgesicherte Supabase-Funktion und besitzt zusätzlich einen RLS-Kompatibilitätsweg.
- `index.html` lädt `js/app.js?v=36`, damit Netlify und der Browser nicht die alte JavaScript-Datei aus dem Cache verwenden.

## Installation

### 1. GitHub aktualisieren

Den **gesamten Inhalt dieses Ordners** in das Hauptverzeichnis des GitHub-Repositories hochladen und vorhandene Dateien ersetzen.

Wichtig:

- `index.html` ersetzen
- `js/app.js` ersetzen
- die übrigen enthaltenen Dateien und Ordner ebenfalls übernehmen
- ein eventuell früher hochgeladenes `js/admin-star-delete.js` kann gelöscht werden

Empfohlene Commit-Nachricht:

`Add reliable admin deletion for published stars`

### 2. Supabase einmalig aktualisieren

1. Supabase öffnen.
2. **SQL Editor** öffnen.
3. Den vollständigen Inhalt von `RUN_ONCE_IN_SUPABASE.sql` einfügen.
4. **Run** drücken.
5. Die Meldung muss ohne Fehler abgeschlossen werden.

Alternativ kann die Migration unter
`supabase/migrations/20260801183000_admin_delete_published_memorials.sql`
über eine korrekt eingerichtete Supabase-GitHub-Integration ausgeführt werden. Der manuelle SQL-Editor ist für diesen einmaligen Schritt eindeutiger.

### 3. Netlify-Deploy prüfen

Nach dem GitHub-Commit muss Netlify den neuen Stand veröffentlichen. Danach die Website vollständig neu laden. Auf Android/Chrome gegebenenfalls den Browser-Tab schließen und neu öffnen.

## Funktion testen

1. Bei Skysbridge mit dem Administratorkonto anmelden.
2. Zum Bereich **Administration – Review and moderation** gehen.
3. Unter **Published stars** muss jeder veröffentlichte Memorial-Stern erscheinen.
4. **Delete star** drücken.
5. Die Sicherheitsabfrage bestätigen.
6. Der Stern muss sofort aus der Adminliste und aus der Wall of Stars verschwinden.

## Falls „Administrator access is required“ erscheint

In Supabase unter `Table Editor > profiles` beim eigenen Benutzer prüfen:

- `is_admin` muss `true` sein.
- Die `id` muss zur ID des aktuell angemeldeten Supabase-Benutzers gehören.

Danach auf der Website abmelden und erneut anmelden.
