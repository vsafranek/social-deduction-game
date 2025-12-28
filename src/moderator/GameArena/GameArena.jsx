import React, { useEffect, useState, useRef, useMemo } from "react";
import { gameApi } from "../../api/gameApi";
import CenterCircle from "./CenterCircle";
import PlayersCircle from "./PlayersCircle";
import FloatingLogDock from "./FloatingLogDock";
import InGameModMenu from "./InGameModMenu";
import PhaseTransition from "./PhaseTransition";
import GameEndScreen from "./GameEndScreen";
import "./GameArena.css";

function GameArena({ gameState, onRefresh, onReturnToMenu }) {
  const [remaining, setRemaining] = useState(null);
  const [transition, setTransition] = useState(null);
  const [showEndScreen, setShowEndScreen] = useState(false);

  const phase = gameState.game.phase;
  const phaseEndsAt = gameState.game?.timerState?.phaseEndsAt;
  const round = gameState.game?.round || 0;

  // Vyber náhodné pozadí na základě fáze a kola (pro variabilitu)
  const backgroundImage = useMemo(() => {
    if (phase === "day" || phase === "voting_reveal") {
      const dayVariants = [1, 2, 3, 4, 5];
      // Použij round pro deterministický výběr (stejné kolo = stejné pozadí)
      // Oprava: přidáme dayVariants.length, aby se negativní hodnoty správně zpracovaly
      const index = (round - 1 + dayVariants.length) % dayVariants.length;
      const variant = dayVariants[index];
      return `/backgrounds/day_${variant}.png`;
    } else if (phase === "night") {
      const nightVariants = [1, 2, 3, 4, 5];
      // Oprava: přidáme nightVariants.length, aby se negativní hodnoty správně zpracovaly
      const index = (round - 1 + nightVariants.length) % nightVariants.length;
      const variant = nightVariants[index];
      return `/backgrounds/night_${variant}.png`;
    }
    return null;
  }, [phase, round]);

  const countdownZeroTriggeredRef = useRef(false);
  const previousPhaseRef = useRef(null);
  const transitionTriggeredRef = useRef(false);
  const transitionTimeoutRef = useRef(null);
  const transitionEndTimeoutRef = useRef(null);
  const endScreenTriggeredRef = useRef(false);
  const endScreenTimeoutRef = useRef(null);

  // Reset trigger when server phase changes
  useEffect(() => {
    countdownZeroTriggeredRef.current = false;
    // Reset transitionTriggeredRef když se fáze změní, aby se mohla spustit nová animace
    const prevPhase = previousPhaseRef.current;
    if (prevPhase !== null && prevPhase !== phase) {
      transitionTriggeredRef.current = false;
    }
  }, [phase]);

  // Inicializace previousPhaseRef při prvním renderu
  useEffect(() => {
    if (previousPhaseRef.current === null && phase) {
      previousPhaseRef.current = phase;
    }
  }, [phase]);

  // Hlavní useEffect pro spuštění přechodové animace při změně fáze
  useEffect(() => {
    const prevPhase = previousPhaseRef.current;

    // Aktualizovat previousPhaseRef pouze když se fáze skutečně změní
    if (prevPhase !== phase) {
      // Pokud se fáze změnila z day/night na day/night, spusť animaci
      if (
        prevPhase !== null &&
        (prevPhase === "day" || prevPhase === "night") &&
        (phase === "day" || phase === "night") &&
        !transitionTriggeredRef.current
      ) {
        console.log(`🎬 [TRANSITION] Phase changed: ${prevPhase} → ${phase}`);

        // Zruš předchozí timeouty, pokud existují
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }
        if (transitionEndTimeoutRef.current) {
          clearTimeout(transitionEndTimeoutRef.current);
          transitionEndTimeoutRef.current = null;
        }

        // Zruš předchozí animaci, pokud existuje
        setTransition(null);

        // Krátká pauza před spuštěním nové animace (aby se stihla zrušit předchozí)
        transitionTimeoutRef.current = setTimeout(() => {
          transitionTriggeredRef.current = true;
          setTransition({ from: prevPhase, to: phase });

          // Trackovaný timeout pro ukončení animace
          transitionEndTimeoutRef.current = setTimeout(() => {
            setTransition(null);
            transitionTriggeredRef.current = false;
            transitionEndTimeoutRef.current = null;
          }, 2500);

          transitionTimeoutRef.current = null;
        }, 50);
      } else {
        // Pokud se fáze změnila na "end" nebo jinou fázi, zruš všechny pending timeouts
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }
        if (transitionEndTimeoutRef.current) {
          clearTimeout(transitionEndTimeoutRef.current);
          transitionEndTimeoutRef.current = null;
        }
        // Zruš předchozí animaci, pokud existuje
        setTransition(null);
      }

      // Handle end phase - zobrazit end screen okamžitě
      if (phase === "end" && !endScreenTriggeredRef.current) {
        console.log(`🎬 [END SCREEN] Phase changed: ${prevPhase} → ${phase}`);
        endScreenTriggeredRef.current = true;
        setShowEndScreen(true);
      } else if (phase !== "end" && prevPhase === "end") {
        // Reset end screen when leaving end phase
        endScreenTriggeredRef.current = false;
        setShowEndScreen(false);
        if (endScreenTimeoutRef.current) {
          clearTimeout(endScreenTimeoutRef.current);
          endScreenTimeoutRef.current = null;
        }
      }

      // Aktualizovat previousPhaseRef až po zpracování změny fáze
      previousPhaseRef.current = phase;
    }

    // Cleanup funkce pro zrušení všech timeoutů při změně fáze nebo unmountu
    // Musí být vždy vrácena, ne jen uvnitř podmínky pro animaci
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      if (transitionEndTimeoutRef.current) {
        clearTimeout(transitionEndTimeoutRef.current);
        transitionEndTimeoutRef.current = null;
      }
    };
  }, [phase]); // Odstraněna závislost na gameState - phase se mění nezávisle

  // Frontend countdown (pouze pokud není end)
  useEffect(() => {
    if (phase === "end") return; // Žádný countdown po konci hry

    let mounted = true;
    let countdownInterval = null;

    const updateCountdown = () => {
      if (!phaseEndsAt) {
        if (mounted) setRemaining(null);
        return;
      }

      const endsAtMs = new Date(phaseEndsAt).getTime();
      const diff = Math.max(0, endsAtMs - Date.now());
      const sec = Math.floor(diff / 1000);

      if (mounted) setRemaining(sec);

      if (sec === 0 && !countdownZeroTriggeredRef.current) {
        countdownZeroTriggeredRef.current = true;
        const nextPhase = phase === "day" ? "night" : "day";

        console.log(`⏰ [COUNTDOWN] Hit 0: ${phase} → ${nextPhase}`);

        // NESPOUŠTĚT transition zde - necháme to na hlavní useEffect, který se spustí
        // když se fáze skutečně změní. Tím se zabrání duplicitnímu zobrazení.

        // Zavolej endPhase a aktualizuj stav
        gameApi
          .endPhase(gameState.game._id)
          .then((response) => {
            if (mounted && response.success && onRefresh) {
              // Okamžitě aktualizuj stav, aby se fáze změnila bez čekání na sync
              onRefresh();
            }
          })
          .catch((e) => {
            console.error("❌ End-phase error:", e);
          });
      }
    };

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);

    return () => {
      mounted = false;
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [phaseEndsAt, phase, gameState.game._id]);

  // Periodic sync
  useEffect(() => {
    let mounted = true;
    let syncInterval = null;

    const doSync = async () => {
      try {
        const freshState = await gameApi.getGameState(gameState.game._id);

        if (freshState.game.phase !== phase) {
          console.log(
            `🔄 [SYNC] Phase changed: ${phase} → ${freshState.game.phase}`
          );

          // Animace se spustí automaticky přes hlavní useEffect při změně fáze

          if (onRefresh) await onRefresh();
        }
      } catch (e) {
        console.error("❌ Sync error:", e);
      }
    };

    syncInterval = setInterval(doSync, 2000);
    doSync();

    return () => {
      mounted = false;
      if (syncInterval) clearInterval(syncInterval);
      if (endScreenTimeoutRef.current) {
        clearTimeout(endScreenTimeoutRef.current);
        endScreenTimeoutRef.current = null;
      }
    };
  }, [gameState.game._id, onRefresh, gameState.players, phase]);

  const handleReturnToLobby = async () => {
    await gameApi.resetToLobby(gameState.game._id);
    await onRefresh();
  };

  // Pokud je hra u konce, zobraz end screen
  if (phase === "end") {
    return (
      <GameEndScreen
        gameState={gameState}
        onReturnToLobby={handleReturnToLobby}
        onReturnToMenu={onReturnToMenu}
      />
    );
  }

  // Determine phase for className (voting_reveal uses day background)
  const phaseClass = phase === "voting_reveal" ? "day" : phase;

  return (
    <div
      className={`game-arena ${phaseClass}`}
      style={
        backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {}
      }
    >
      <InGameModMenu
        gameId={gameState.game._id}
        onReturnToLobby={handleReturnToLobby}
      />

      <CenterCircle
        phase={phaseClass}
        round={gameState.game.round}
        aliveCount={gameState.players.filter((p) => p.alive).length}
        countdownSec={remaining}
      />

      <PlayersCircle
        players={gameState.players}
        phase={phaseClass}
        game={gameState.game}
      />
      <FloatingLogDock
        logs={gameState.logs || []}
        players={gameState.players}
      />

      <div className={`atmosphere-overlay ${phase}`}></div>

      {transition && (
        <PhaseTransition from={transition.from} to={transition.to} />
      )}
    </div>
  );
}

export default GameArena;
