# Přehled chybějících testů

## ✅ Už otestováno
- `nightActionResolver` - včetně Monk role (unit testy)
- `votingResolver` (unit testy)
- `victoryEvaluator` (unit testy)
- `gameRoutes.integration.test.js` - základní CRUD operace (Game, Player, GameLog)
- `gameRoutes.helpers.test.js` - `getAllAvailableAvatars()` filtrování

## ❌ Chybí testování

### 1. API Endpoint testy pro `set-night-action` s Monk
**Soubor:** `electron/routes/__tests__/gameRoutes.integration.test.js` (rozšířit)
**Co testovat:**
- ✅ Monk může nastavit akci když má `usesRemaining > 0`
- ❌ Monk nemůže nastavit akci když má `usesRemaining <= 0`
- ❌ `usesRemaining` se inicializuje z `maxUses` pokud není nastaveno
- ❌ Monk nemůže cílit živé hráče (validace targetu)
- ❌ Monk může cílit mrtvé hráče

### 2. API Endpoint testy pro `start-config` s Monk
**Soubor:** `electron/routes/__tests__/gameRoutes.integration.test.js` (rozšířit)
**Co testovat:**
- ❌ `usesRemaining` se inicializuje pro Monk při `start-config`
- ❌ `usesRemaining` je nastaveno na `maxUses` (2) pro Monk

### 3. Helper funkce v `gameRoutes.js`
**Soubor:** `electron/routes/__tests__/gameRoutes.helpers.test.js` (rozšířit)

#### `assignRandomAvatar()`
- ✅ Filtrování detail avatary (už otestováno přes `getAllAvailableAvatars`)
- ❌ Vrací `null` když nejsou dostupné avatary
- ❌ Vrací náhodný avatar z dostupných

#### Utility funkce (volitelné - nízká priorita)
- `nowMs()` - utility funkce, jednoduchá
- `endInMs(sec)` - utility funkce, jednoduchá
- `clampNum(v, min, max, fallback)` - validace čísel
- `normalizeChance(val, def)` - normalizace pravděpodobnosti

#### Effect funkce (volitelné - střední priorita)
- `hasEffect(p, effectType)` - kontrola existence efektu
- `addEffect(target, type, sourceId, expiresAt, meta)` - přidání efektu
- `removeEffects(target, predicate)` - odstranění efektů
- `clearExpiredEffects(players)` - vymazání expirovaných efektů

#### `formatGameStateResponse(game, players, logs)`
- ❌ Správně formátuje hráče (zahrnuje pouze povolená pole)
- ❌ Správně formátuje game state
- ❌ Správně formátuje logs

#### `emitGameStateUpdate(gameId, immediate)` 
- ❌ Toto je integrace s EventEmitterem - může být otestováno jako integration test
- ❌ Debouncing logika (immediate flag)

### 4. `gameStateEmitter.js` modul
**Soubor:** `electron/routes/__tests__/gameStateEmitter.test.js` (nový soubor)
**Co testovat:**
- ❌ `emitGameStateUpdate()` emituje event pro správné gameId
- ❌ `subscribe()` přidává listener
- ❌ Unsubscribe funkce správně odstraňuje listener
- ❌ Více subscriberů pro stejný gameId

### 5. Integration testy pro `/join` endpoint
**Soubor:** `electron/routes/__tests__/gameRoutes.integration.test.js` (rozšířit)
**Co testovat:**
- ❌ `assignRandomAvatar()` se volá a přiřadí avatar novému hráči
- ❌ Endpoint vrací 500 když `assignRandomAvatar()` vrátí `null`
- ❌ Existující hráč bez avatara dostane náhodný avatar

## Priorita testování

### Vysoká priorita (doporučeno implementovat)
1. **API endpoint testy pro `set-night-action` s Monk** - kritická funkcionalita
2. **API endpoint testy pro `start-config` s Monk** - inicializace role data

### Střední priorita
3. **Integration testy pro `/join` endpoint s avatary** - edge case handling
4. **`formatGameStateResponse()`** - důležitá helper funkce

### Nízká priorita (volitelné)
5. **Utility funkce** (`nowMs`, `endInMs`, `clampNum`, `normalizeChance`) - jednoduché funkce
6. **Effect funkce** - pokud se často mění, testy pomohou
7. **`gameStateEmitter` modul** - jednoduchý EventEmitter wrapper
8. **`emitGameStateUpdate()` debouncing** - komplexnější integration test
