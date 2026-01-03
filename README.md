# Social Deduction Game

Sociální dedukční hra s moderátorem a mobilními hráči.

## Struktura projektu

Tento projekt obsahuje:
- **Backend** (Electron + Express + Supabase) - v tomto repozitáři
- **Frontend** - jako git submodule v adresáři `frontend/`

## Instalace

### První klonování

Při klonování tohoto repozitáře použijte:

```bash
git clone --recursive <repo-url>
```

Nebo po standardním klonování:

```bash
git submodule update --init --recursive
```

### Instalace závislostí

1. Nainstalujte závislosti hlavního projektu:
```bash
npm install
```

2. Nainstalujte závislosti frontend submodulu:
```bash
cd frontend
npm install
cd ..
```

## Spuštění

### Development režim

```bash
npm run dev
```

Tento příkaz spustí:
- Frontend dev server (Vite) na `http://localhost:5173`
- Electron aplikaci s backend serverem na `http://localhost:3001`

### Production build

```bash
npm run build
```

Tento příkaz buildne frontend do `frontend/dist/`.

### Spuštění production build

```bash
npm start
```

## Práce se submodulem

### Aktualizace frontend submodulu

```bash
npm run submodule:update
```

Nebo ručně:
```bash
cd frontend
git pull origin main
cd ..
```

### Inicializace submodulu (pro nové klony)

```bash
npm run submodule:init
```

## Frontend repozitář

Frontend je samostatný repozitář, který může běžet nezávisle. Více informací najdete v `frontend/README.md`.

## Dokončení nastavení submodulu

Pokud jste právě oddělili frontend do samostatného repozitáře, musíte dokončit následující kroky:

### 1. Vytvoření GitHub repozitáře

1. Vytvořte nový prázdný repozitář na GitHubu (např. `social-deduction-game-frontend`)
2. Přidejte remote do frontend adresáře:

```bash
cd frontend
git remote add origin <github-frontend-repo-url>
git push -u origin master
cd ..
```

### 2. Přidání jako git submodule

Po vytvoření GitHub repozitáře přidejte frontend jako submodule do hlavního repozitáře:

```bash
# Odstranit stávající frontend adresář (pokud ještě není submodule)
rm -rf frontend

# Přidat jako submodule
git submodule add <github-frontend-repo-url> frontend

# Commit změny
git commit -m "Add frontend as git submodule"
```

**Poznámka:** Pokud už máte frontend adresář s git repozitářem, můžete ho jednoduše přidat jako submodule pomocí `git submodule add` (git automaticky rozpozná existující repozitář).
