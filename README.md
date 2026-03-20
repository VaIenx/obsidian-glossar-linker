# Glossar Linker

Ein Obsidian-Plugin das deinen Vault nach Begriffen aus deinen Fach-Glossarien scannt und sie auf Wunsch automatisch verlinkt — mit vollständiger Vorschau bevor irgendetwas geändert wird.

---

## Voraussetzungen

Das Plugin setzt voraus dass deine Glossarien folgende Struktur haben:

```
Glossar/
├── Geschichte.md
├── Wirtschaft.md
├── Biologie.md
└── ...
```

Jede Glossar-Datei enthält Einträge als Obsidian-Callouts:

```markdown
> [!glossar]+ Otto von Bismarck
> **Definition:** Preußischer Ministerpräsident ab 1862...
> **Kategorie:** Geschichte
> **Quelle:** [[Bismarcks Innenpolitik]]
```

Der Begriff steht immer hinter dem `+` des Callouts. Der Callout-Typ (`glossar`, `warning`, `tip` etc.) spielt keine Rolle — alle werden erkannt.

---

## Installation

Da das Plugin nicht im offiziellen Community-Plugin-Store ist, muss es manuell installiert werden:

1. Ordner `.obsidian/plugins/glossar-linker/` in deinem Vault erstellen
2. `main.js` und `manifest.json` dort hinein kopieren
3. Obsidian neu starten
4. Einstellungen → Community Plugins → Safe Mode deaktivieren (falls noch aktiv)
5. "Glossar Linker" in der Plugin-Liste aktivieren

---

## Verwendung

### Befehl ausführen

`Strg+P` → **"Glossar: Vault scannen und Begriffe verlinken"**

Das Plugin führt dann folgende Schritte aus:

**1. Glossarien einlesen**
Alle `.md`-Dateien im `Glossar/`-Ordner werden geparst. Jeder Callout-Eintrag wird als Begriff registriert, zusammen mit dem Dateinamen als Kategorie.

**2. Vault scannen**
Alle Markdown-Dateien außerhalb des `Glossar/`-Ordners werden nach unverlinkten Begriffen durchsucht. Bereits verlinkte Vorkommen (`[[Glossar/Geschichte#Otto%20von%20Bismarck|Otto von Bismarck]]`) werden dabei übersprungen.

**3. Review-Modal**
Für jeden gefundenen Treffer öffnet sich ein Fenster mit:
- Dateiname und Begriff
- Kontext (50 Zeichen vor und nach dem Treffer)
- Häkchen pro Vorkommen — du entscheidest welche verlinkt werden
- "Alle auswählen" / "Keine" für schnelle Entscheidungen
- Navigation zwischen allen Treffern

**4. Speichern**
Erst nach Klick auf "Änderungen speichern" werden die Dateien tatsächlich verändert. Bis dahin passiert nichts.

---

## Wie Links aussehen

Ein gefundener Begriff wird so verlinkt:

```
Otto von Bismarck
→ [[Glossar/Geschichte#Otto%20von%20Bismarck|Otto von Bismarck]]
```

Der Link zeigt direkt auf den Callout-Anker in der entsprechenden Glossar-Datei. Leerzeichen werden als `%20` kodiert damit der Anker korrekt funktioniert.

---

## Was das Plugin nicht tut

- Es verändert niemals Dateien im `Glossar/`-Ordner selbst
- Es verlinkt keine Begriffe die bereits verlinkt sind
- Es speichert nichts ohne deine explizite Bestätigung
- Es läuft nicht automatisch im Hintergrund — nur wenn du den Befehl ausführst

---

## Zusammenspiel mit dem Glossar-Templater

Dieses Plugin ergänzt das Templater-Script zum Hinzufügen neuer Einträge:

| Aufgabe | Werkzeug |
|---|---|
| Neuen Begriff ins Glossar eintragen | Templater-Script (`Alt+G`) |
| Begriff in aktueller Note verlinken | Templater-Script (automatisch beim Eintragen) |
| Bereits bestehende Notes nachträglich verlinken | Dieses Plugin |

Der typische Workflow: du trägst einen Begriff neu ein, das Templater-Script verlinkt ihn in der aktuellen Note. Danach führst du einmalig den Plugin-Befehl aus um alle älteren Notes nachzuziehen.
