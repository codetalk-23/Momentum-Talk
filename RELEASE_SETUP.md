# Release Setup Checklist

Repo: https://github.com/codetalk-23/Handy

## Status
- [x] build.yml: ORT download URLs hersteld naar blob.handy.computer
- [x] tauri.conf.json: Windows signCommand verwijderd
- [x] release.yml: sign-binaries: false (tijdelijk)
- [x] Updater keypair gegenereerd (~/.tauri/momentumtalk.key)
- [x] Apple Developer account aangemaakt
- [ ] GitHub secrets toevoegen
- [ ] tauri.conf.json updaten (pubkey + endpoint + createUpdaterArtifacts)
- [ ] Apple certificate genereren en toevoegen
- [ ] release.yml: sign-binaries: true
- [ ] Release workflow triggeren

---

## Stap 1 — GitHub Secrets toevoegen (doe dit nu)

Ga naar: https://github.com/codetalk-23/Handy/settings/secrets/actions

Voeg toe:

| Secret naam | Waarde |
|-------------|--------|
| `TAURI_SIGNING_PRIVATE_KEY` | Inhoud van `~/.tauri/momentumtalk.key` (hele bestand) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Het wachtwoord dat je hebt gekozen bij genereren |

---

## Stap 2 — tauri.conf.json aanpassen

Bestand: `src-tauri/tauri.conf.json`

Verander:
```json
"createUpdaterArtifacts": false,
```
naar:
```json
"createUpdaterArtifacts": true,
```

Vervang de `pubkey` waarde:
```json
"pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEU4MTRFOEIzMEYwNDA2MEYKUldRUEJnUVBzK2dVNkZuN2tFbHNLaHBJZGpnNnJuS1JZTExRaTdYbGFMVE9MR04ydStjOUl5OVgK",
```

Vervang de `endpoints` URL:
```json
"endpoints": [
  "https://github.com/codetalk-23/Handy/releases/latest/download/latest.json"
]
```

---

## Stap 3 — Apple Certificate genereren

1. Open **Xcode** → Settings → Accounts → selecteer je Apple ID → Manage Certificates
2. Klik `+` → kies **Developer ID Application**
3. Certificaat staat nu in je Keychain

Of via browser:
1. Ga naar https://developer.apple.com/account/resources/certificates/list
2. Klik `+` → Developer ID Application
3. Volg de stappen (CSR aanmaken via Keychain Access → Certificate Assistant → Request a Certificate)
4. Download het .cer bestand en dubbelklik om te installeren in Keychain

### Exporteren als .p12
1. Open **Keychain Access**
2. Zoek "Developer ID Application: [jouw naam]"
3. Rechtermuisknop → Export → sla op als `certificate.p12` met een wachtwoord
4. Base64 encodeer het:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```
   (staat nu in je clipboard)

### App-specific password aanmaken
1. Ga naar https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
2. Genereer een nieuw wachtwoord, sla het op

### GitHub Secrets toevoegen voor Apple signing

Ga naar: https://github.com/codetalk-23/Handy/settings/secrets/actions

| Secret naam | Waarde |
|-------------|--------|
| `APPLE_CERTIFICATE` | Base64 output van je .p12 (uit clipboard) |
| `APPLE_CERTIFICATE_PASSWORD` | Het wachtwoord van je .p12 export |
| `KEYCHAIN_PASSWORD` | Verzin een willekeurig wachtwoord (bijv. `ci-keychain-2024`) |
| `APPLE_ID` | Je Apple ID e-mailadres |
| `APPLE_ID_PASSWORD` | Het app-specific password van stap hierboven |
| `APPLE_TEAM_ID` | Te vinden op https://developer.apple.com/account — staat rechtsboven als een code van 10 tekens bijv. `ABC123DEF4` |

---

## Stap 4 — release.yml: signing aanzetten

Bestand: `.github/workflows/release.yml`

Verander:
```yaml
sign-binaries: false
```
naar:
```yaml
sign-binaries: true
```

---

## Stap 5 — Committen en releasen

```bash
git add src-tauri/tauri.conf.json .github/workflows/release.yml
git commit -m "chore: enable updater artifacts and apple signing"
git push
```

Ga dan naar: https://github.com/codetalk-23/Handy/actions/workflows/release.yml
→ klik **Run workflow** → **Run workflow**

De release wordt aangemaakt als draft. Zodra alle jobs groen zijn, ga je naar:
https://github.com/codetalk-23/Handy/releases
→ klik **Edit** op de draft → **Publish release**

---

## Wat gebruikers dan zien

- **macOS (met signing):** Gewoon openen, geen waarschuwing
- **macOS (zonder signing):** Rechtermuisknop → Openen → eenmalig bevestigen
- **Windows:** SmartScreen waarschuwing (unsigned) — klik "More info" → "Run anyway"
  - Windows signing via Azure Trusted Signing is optioneel, kan later
