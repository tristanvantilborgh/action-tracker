# ACTIEPUNTEN

Een professionele React-applicatie voor het beheren van actiepunten uit XML-vergaderverslagen.

## Functionaliteiten

### Extractie uit XML-verslagen
- **Project ID** - Uit `<meta><projectId>`
- **Datum** - Uit `<meta><date>`
- **Verantwoordelijke** - Uit `<action><assignee>`
- **Actie** - Uit `<action><text>`

### Toegevoegde velden per actiepunt
- **Uitgevoerd-vinkje** - Klikbaar om status te wijzigen
- **Opmerking uitvoering** - Vrij tekstveld

### Sorteren & filteren
- Klik op kolomkoppen om te sorteren (project, datum, verantwoordelijke, status)
- Filter op status (openstaand/afgerond), project en verantwoordelijke

### Extra functionaliteit
- Drag & drop XML-bestanden of klik om te selecteren
- Duplicaat-detectie (voorkomt dubbele imports)
- CSV-export met alle gefilterde data
- Statistieken dashboard (totaal/afgerond/openstaand)
- Persistente opslag (data blijft bewaard tussen sessies)

## Installatie

```bash
npm install
npm start
```

## XML-structuur

De applicatie verwacht XML-bestanden met de volgende structuur:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mom version="7" lang="NL">
  <meta>
    <projectId>PROJECT_ID</projectId>
    <docType>MOM</docType>
    <subject>Vergader onderwerp</subject>
    <date>2026-03-13</date>
  </meta>
  <actions>
    <action>
      <text>Beschrijving van de actie</text>
      <assignee>Naam Verantwoordelijke</assignee>
    </action>
  </actions>
</mom>
```

## Technologie

- React 18
- Tailwind CSS
- Lucide React Icons

## Licentie

MIT
