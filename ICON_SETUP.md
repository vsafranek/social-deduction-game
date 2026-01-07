# Icon Setup Guide

## Umístění ikon

Pro správné zobrazení ikony v Electron i webové aplikaci umístěte ikony do následujících složek:

### Pro Electron aplikaci:
- **`build/icon.png`** - Hlavní ikona pro Electron (univerzální, funguje na všech platformách)
  - Doporučená velikost: 512x512 px nebo 1024x1024 px
  - Formát: PNG s transparentním pozadím

- **Volitelně pro lepší podporu na různých platformách:**
  - `build/icon.ico` - Pro Windows (pokud máte .ico soubor)
  - `build/icon.icns` - Pro macOS (pokud máte .icns soubor)
  - `build/icon.png` - Pro Linux a jako fallback

### Pro webovou aplikaci (Next.js):
- **`frontend/app/icon.png`** - Favicon pro webovou aplikaci
  - Doporučená velikost: 32x32 px, 64x64 px, nebo 512x512 px
  - Formát: PNG nebo ICO
  - Next.js automaticky detekuje `icon.png`, `icon.ico`, nebo `icon.svg` v `app/` složce

## Alternativní umístění

Pokud chcete použít stejnou ikonu pro oba účely, můžete:
1. Umístit ikonu do `build/icon.png` pro Electron
2. Vytvořit symlink nebo kopii do `frontend/app/icon.png` pro web

## Formáty souborů

- **PNG**: Univerzální formát, funguje všude
- **ICO**: Lepší pro Windows, podporuje více velikostí v jednom souboru
- **SVG**: Pro Next.js favicon (moderní prohlížeče)
- **ICNS**: Nativní formát pro macOS

## Po umístění ikon

Po umístění ikon do správných složek:
1. Restartujte vývojový server (`npm run dev`)
2. Pro produkční build: `npm run package` (pro Electron)
3. Pro web: Next.js automaticky použije ikonu z `app/icon.*`

