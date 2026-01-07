# Production Build Checklist

## ✅ Dokončeno

### Ikony a Favicony
- ✅ `build/icon.PNG` - Ikona pro Electron aplikaci
- ✅ `build/favicon.ico` - Favicon pro Electron (fallback)
- ✅ `build/favicon.PNG` - Favicon PNG pro Electron
- ✅ `frontend/app/icon.PNG` - Favicon pro webovou aplikaci
- ✅ `frontend/app/favicon.ico` - Favicon ICO pro webovou aplikaci
- ✅ `frontend/app/favicon.PNG` - Favicon PNG pro webovou aplikaci
- ✅ Kód podporuje case-insensitive hledání ikon (icon.png, icon.PNG, favicon.*, atd.)
- ✅ Electron main.js - podpora ikon pro hlavní okno i player okna
- ✅ Next.js layout.tsx - metadata pro favicon

### Splash Screen
- ✅ `electron/splash.html` - Fullscreen splash screen s obrázkem
- ✅ `electron/splash_screen.png` - Pozadí pro splash screen
- ✅ `frontend/public/splash_screen.png` - Pozadí pro AppLoadingScreen (web)
- ✅ Splash screen se zobrazí při startu Electron aplikace
- ✅ Splash screen má stejný design jako hlavní menu (MedievalSharp font, zlatá barva)
- ✅ Splash screen se automaticky přizpůsobí velikosti hlavního okna (fullscreen nebo 1400x900)
- ✅ AppLoadingScreen přizpůsoben stylu splash screenu
- ✅ AppLoadingScreen přeskočen v Electronu (splash screen už zobrazuje loading)
- ✅ Plynulý přechod ze splash screenu do menu (bez probliknutí)

### Settings (Persistentní nastavení)
- ✅ `electron/store.js` - Electron-store wrapper pro persistentní ukládání
- ✅ Fullscreen mode - výchozí zapnutý, uloží se a obnoví při restartu
- ✅ Always on top - uloží se a obnoví při restartu
- ✅ Settings modal - přístup z hlavního menu i z lobby/moderator menu
- ✅ Settings se ukládají do `~/.config/config.json` (electron-store)

### UI/UX v produkci
- ✅ File/Edit/View menu odstraněno v produkci (Menu.setApplicationMenu(null))
- ✅ DevTools skryto v produkci (pouze v dev módu)
- ✅ Frame (title bar) se dynamicky skrývá/zobrazuje podle fullscreen stavu
- ✅ Window controls (minimize, maximize, close) se zobrazí když není fullscreen
- ✅ Background barvy a styly konzistentní napříč aplikací

### Základní konfigurace
- ✅ package.json - electron-builder konfigurace s ikonami pro všechny platformy
- ✅ package.json - metadata (author, license, copyright)
- ✅ .gitignore - `dist-electron` přidán do ignorovaných souborů

## 🔧 Co ještě přidat pro produkční verzi

### 1. Metadata a informace o aplikaci

#### V `package.json` (částečně přidáno):
- ✅ `author` - Autor aplikace
- ✅ `license` - Licence (aktuálně UNLICENSED)
- ✅ `build.copyright` - Copyright informace
- ⚠️ **Doporučeno přidat:**
  - `repository` - URL repozitáře (pokud je veřejný)
  - `homepage` - URL domovské stránky aplikace
  - `bugs` - URL pro hlášení bugů

#### Příklad:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/game-app.git"
  },
  "homepage": "https://yourwebsite.com",
  "bugs": {
    "url": "https://github.com/yourusername/game-app/issues"
  }
}
```

### 2. Code Signing (pro distribuci)

#### Windows:
- ⚠️ **Potřebujete:** Code signing certificate (.p12 nebo .pfx)
- Přidejte do `package.json` → `build.win`:
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password"
}
```

#### macOS:
- ⚠️ **Potřebujete:** Apple Developer ID certificate
- Přidejte do `package.json` → `build.mac`:
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)"
}
```

**Poznámka:** Code signing je volitelné pro testování, ale **povinné** pro distribuci přes App Store nebo Microsoft Store.

### 3. Optimalizace ikon

#### Pro lepší kvalitu na různých platformách:

**Windows:**
- ⚠️ Vytvořte `build/icon.ico` z vašeho PNG
  - Mělo by obsahovat více velikostí: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
  - Nástroje: [ICO Convert](https://icoconvert.com/) nebo [ImageMagick](https://imagemagick.org/)

**macOS:**
- ⚠️ Vytvořte `build/icon.icns` z vašeho PNG
  - Mělo by obsahovat: 16x16, 32x32, 128x128, 256x256, 512x512, 1024x1024
  - Nástroje: [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html) (součást macOS) nebo online konvertory

**Linux:**
- ✅ `build/icon.png` je dostačující (doporučená velikost: 512x512 nebo 1024x1024)

### 4. Auto-updater

- ⚠️ **Pro automatické aktualizace:** Přidat `electron-updater`
- Vyžaduje hosting pro update server (např. GitHub Releases, S3, atd.)
- Konfigurace v `package.json` → `build.publish`

#### Instalace:
```bash
npm install electron-updater --save-dev
```

#### Základní konfigurace v `package.json`:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "yourusername",
      "repo": "game-app"
    }
  }
}
```

### 5. Environment Variables

- ⚠️ **Zkontrolujte:** Že všechny environment variables jsou správně nastaveny pro produkci
- Vytvořte `.env.production` soubor pokud je potřeba
- Ujistěte se, že citlivé údaje nejsou v kódu
- ⚠️ **Důležité:** Zkontrolujte Supabase credentials a další API klíče

### 6. Build Scripts

- ✅ `npm run package` - Vytvoří produkční build pro všechny platformy
- ⚠️ **Doporučeno přidat:**
  - `npm run package:win` - Build pouze pro Windows
  - `npm run package:mac` - Build pouze pro macOS
  - `npm run package:linux` - Build pouze pro Linux

#### Příklad v `package.json`:
```json
"scripts": {
  "package:win": "npm run build && electron-builder --win",
  "package:mac": "npm run build && electron-builder --mac",
  "package:linux": "npm run build && electron-builder --linux"
}
```

### 7. Testing Production Build

- ⚠️ **Důležité:** Otestujte produkční build před distribucí:
  1. Spusťte `npm run package`
  2. Nainstalujte vytvořený installer
  3. Otestujte všechny funkce:
     - ✅ Spuštění aplikace (splash screen)
     - ✅ Hlavní menu
     - ✅ Settings (fullscreen, always on top)
     - ✅ Vytvoření hry
     - ✅ Připojení hráčů
     - ✅ Hra sama
  4. Zkontrolujte, že ikony se zobrazují správně
  5. Otestujte na čistém systému (bez dev dependencies)
  6. Otestujte fullscreen a window mode přepínání
  7. Otestujte persistentní nastavení (restart aplikace)

### 8. Dokumentace

- ⚠️ **Doporučeno:** Vytvořit/aktualizovat `README.md` s instrukcemi pro:
  - Instalaci (development i production)
  - Spuštění aplikace
  - Konfiguraci (settings, environment variables)
  - Troubleshooting
  - Build a distribuce

### 9. License File

- ⚠️ **Pokud máte licenci:** Vytvořte `LICENSE` soubor v kořenovém adresáři
- Aktualizujte `package.json` → `license` pole (aktuálně UNLICENSED)

### 10. Performance a Optimalizace

- ⚠️ **Zkontrolujte:**
  - Velikost build souborů (zkontrolujte, že nejsou zbytečně velké)
  - Čas spuštění aplikace
  - Memory usage
  - Network requests v produkci

### 11. Error Handling a Logging

- ⚠️ **Zkontrolujte:**
  - Error handling v produkci (uživatelsky přívětivé chybové zprávy)
  - Logging mechanismus (co se loguje v produkci?)
  - Crash reporting (volitelné, např. Sentry)

## 🚀 Rychlý start pro produkční build

1. **Zkontrolujte ikony a soubory:**
   ```bash
   # Zkontrolujte, že ikony existují
   ls build/icon.*
   ls build/favicon.*
   ls frontend/app/icon.*
   ls frontend/app/favicon.*
   ls electron/splash_screen.png
   ls frontend/public/splash_screen.png
   ```

2. **Vytvořte produkční build:**
   ```bash
   # Build frontend
   npm run build
   
   # Build Electron aplikace
   npm run package
   ```

3. **Výsledek:**
   - Windows: `dist-electron/Shadows of Gloaming Setup x.x.x.exe`
   - macOS: `dist-electron/Shadows of Gloaming-x.x.x.dmg`
   - Linux: `dist-electron/Shadows of Gloaming-x.x.x.AppImage`

4. **Otestujte build:**
   - Nainstalujte vytvořený installer
   - Otestujte všechny funkce
   - Zkontrolujte nastavení (fullscreen, always on top)
   - Otestujte restart aplikace (persistentní nastavení)

## 📝 Poznámky

- **Code signing:** Bez code signing certificate budou uživatelé vidět varování při instalaci
- **Auto-updater:** Vyžaduje další konfiguraci a hosting
- **Ikony:** PNG funguje všude, ale .ico a .icns poskytují lepší kvalitu na příslušných platformách
- **Splash screen:** Fullscreen splash screen s obrázkem poskytuje profesionální vzhled
- **Settings:** Persistentní nastavení jsou ukládána pomocí electron-store
- **Production mode:** Menu, DevTools a další dev prvky jsou automaticky skryty v produkci

## 🎯 Priorita úkolů

### Vysoká priorita:
1. ⚠️ Testing production build
2. ⚠️ Environment variables kontrola
3. ⚠️ Dokumentace (README.md)

### Střední priorita:
4. ⚠️ Optimalizace ikon (.ico, .icns)
5. ⚠️ Build scripts pro jednotlivé platformy
6. ⚠️ Error handling a logging

### Nízká priorita (pro distribuci):
7. ⚠️ Code signing certificate
8. ⚠️ Auto-updater
9. ⚠️ License file (pokud potřebujete)
