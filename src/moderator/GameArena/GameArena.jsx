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
  const [showEndScreenAfterTransition, setShowEndScreenAfterTransition] =
    useState(false);
  const [votingRevealData, setVotingRevealData] = useState(null); // { type: 'execution' | 'mayor_election', player: {} }
  const [deadPlayers, setDeadPlayers] = useState([]);

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
  const previousPlayersRef = useRef(null);
  const currentPhaseRef = useRef(phase);
  const previousMayorIdRef = useRef(null);

  // Reset trigger when server phase changes
  useEffect(() => {
    countdownZeroTriggeredRef.current = false;
    // Reset transitionTriggeredRef když se fáze změní, aby se mohla spustit nová animace
    const prevPhase = previousPhaseRef.current;
    if (prevPhase !== null && prevPhase !== phase) {
      // Reset transitionTriggeredRef při přechodu mezi day/night/end
      if (
        (prevPhase === "day" || prevPhase === "night") &&
        (phase === "day" || phase === "night" || phase === "end")
      ) {
        transitionTriggeredRef.current = false;
      }
    }
  }, [phase]);

  // Inicializace previousPhaseRef při prvním renderu
  useEffect(() => {
    if (previousPhaseRef.current === null && phase) {
      previousPhaseRef.current = phase;
    }
  }, [phase]);

  // Inicializace previousPlayersRef a previousMayorIdRef při prvním renderu
  useEffect(() => {
    if (previousPlayersRef.current === null) {
      previousPlayersRef.current = gameState.players.map((p) => ({
        _id: p._id,
        alive: p.alive,
      }));
      previousMayorIdRef.current =
        gameState.game?.mayor || gameState.game?.mayor_id;
    }
  }, [gameState.players, gameState.game]);

  // Aktualizovat previousPlayersRef a previousMayorIdRef vždy, když se změní hráči nebo mayor
  // (ale pouze pokud se fáze nezměnila - aby se zachoval snapshot pro detekci změn při přechodu fáze)
  useEffect(() => {
    const currentPhase = phase;
    const prevPhase = previousPhaseRef.current;

    // Aktualizovat pouze pokud se fáze nezměnila (aby se zachoval snapshot pro detekci při přechodu)
    // Pokud se fáze změnila, aktualizace se provede v hlavním useEffect po detekci reveals
    if (prevPhase === currentPhase && previousPlayersRef.current !== null) {
      previousPlayersRef.current = gameState.players.map((p) => ({
        _id: p._id,
        alive: p.alive,
      }));
      previousMayorIdRef.current =
        gameState.game?.mayor || gameState.game?.mayor_id;
    }
  }, [gameState.players, gameState.game, phase]);

  // Hlavní useEffect pro spuštění přechodové animace při změně fáze
  useEffect(() => {
    const prevPhase = previousPhaseRef.current;
    const prevPlayers = previousPlayersRef.current;
    const prevMayorId = previousMayorIdRef.current;

    // Získat aktuální hodnoty z gameState (bez přidání do dependency array)
    // Použijeme closure pro získání aktuálních hodnot při spuštění effectu
    const currentPlayers = gameState.players;
    const currentMayorId = gameState.game?.mayor || gameState.game?.mayor_id;

    // Aktualizovat previousPhaseRef pouze když se fáze skutečně změní
    if (prevPhase !== phase) {
      // Detekce reveal dat při přechodu fáze
      let detectedVotingReveal = null;
      let detectedDeadPlayers = [];

      // Detekce VotingReveal při přechodu day → night nebo day → end
      if (
        prevPhase === "day" &&
        (phase === "night" || phase === "end") &&
        prevPlayers
      ) {
        // Zkontroluj, jestli někdo zemřel (execution)
        const executedPlayer = currentPlayers.find((p) => {
          const prevPlayer = prevPlayers.find((pp) => pp._id === p._id);
          return prevPlayer && prevPlayer.alive && !p.alive;
        });

        // Zkontroluj, jestli došlo k mayor election (pouze pokud se nepřechází na end)
        const mayorElected =
          phase === "night" && !prevMayorId && currentMayorId;
        const mayorPlayer = mayorElected
          ? currentPlayers.find(
              (p) => p._id?.toString() === currentMayorId?.toString()
            )
          : null;

        if (executedPlayer) {
          // Execution - přidat do voting reveal i do dead players
          console.log(
            `⚖️ [VOTING REVEAL] Execution: ${executedPlayer.name} (phase: ${phase})`
          );
          detectedVotingReveal = {
            type: "execution",
            player: executedPlayer,
          };
          // Přidat executed hráče do dead players pro zobrazení v death reveal sekci
          detectedDeadPlayers.push(executedPlayer);
          console.log(
            `💀 [DEATH REVEAL] Added executed player to dead players: ${executedPlayer.name}`
          );
        } else if (mayorElected && mayorPlayer) {
          // Mayor election
          console.log(`🏛️ [VOTING REVEAL] Mayor elected: ${mayorPlayer.name}`);
          detectedVotingReveal = {
            type: "mayor_election",
            player: mayorPlayer,
          };
        }
      }

      // Detekce DeathReveal při přechodu night → day NEBO night → end
      // - night → day: klasický přechod do dne
      // - night → end: hra končí hned po noci, chceme ukázat, kdo zemřel poslední noc
      if (
        prevPhase === "night" &&
        (phase === "day" || phase === "end") &&
        prevPlayers
      ) {
        const newlyDead = currentPlayers.filter((p) => {
          const prevPlayer = prevPlayers.find((pp) => pp._id === p._id);
          return prevPlayer && prevPlayer.alive && !p.alive;
        });

        if (newlyDead.length > 0) {
          console.log(
            `💀 [DEATH REVEAL] Players died: ${newlyDead
              .map((p) => p.name)
              .join(", ")}`
          );
          detectedDeadPlayers = newlyDead;
        }
      }

      // Vždy spustit PhaseTransition při změně fáze (day ↔ night, day → end)
      if (
        prevPhase !== null &&
        (prevPhase === "day" || prevPhase === "night") &&
        (phase === "day" || phase === "night" || phase === "end") &&
        !transitionTriggeredRef.current
      ) {
        console.log(`🎬 [TRANSITION] Phase changed: ${prevPhase} → ${phase}`);

        // Uložit reveal data do state
        console.log(
          `📊 [TRANSITION DATA] Voting reveal: ${
            detectedVotingReveal ? detectedVotingReveal.type : "none"
          }, Dead players: ${detectedDeadPlayers.length}`
        );
        setVotingRevealData(detectedVotingReveal);
        setDeadPlayers(detectedDeadPlayers);

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

        // Krátká pauza před spuštěním nové animace
        const currentPhaseForTransition = phase; // Uložit aktuální phase pro použití v timeoutu
        transitionTimeoutRef.current = setTimeout(() => {
          transitionTriggeredRef.current = true;
          const toPhase =
            currentPhaseForTransition === "end"
              ? "end"
              : currentPhaseForTransition;
          setTransition({ from: prevPhase, to: toPhase });

          // Pokud jsme v end phase, začít načítat end screen během transitionu
          const currentPhase = gameState.game.phase;
          if (currentPhase === "end" && !endScreenTriggeredRef.current) {
            // Zobrazit end screen hned na začátku transitionu (ale pod transitionem)
            endScreenTriggeredRef.current = true;
            setShowEndScreen(true);
            setShowEndScreenAfterTransition(false);
          }

          // Trackovaný timeout pro ukončení animace (prodlouženo na 6s)
          transitionEndTimeoutRef.current = setTimeout(() => {
            // Pokud jsme v end phase, zobrazit end screen před skrytím transition
            const finalPhase = gameState.game.phase;
            if (finalPhase === "end") {
              setShowEndScreenAfterTransition(true);
              // Krátká pauza před skrytím transition, aby se end screen stihl zobrazit
              setTimeout(() => {
                setTransition(null);
                transitionTriggeredRef.current = false;
                // Vyčistit reveal data po skončení transition
                setVotingRevealData(null);
                setDeadPlayers([]);
              }, 300);
            } else {
              setTransition(null);
              transitionTriggeredRef.current = false;
              // Vyčistit reveal data po skončení transition
              setVotingRevealData(null);
              setDeadPlayers([]);
            }
            transitionEndTimeoutRef.current = null;
          }, 6000);

          transitionTimeoutRef.current = null;
        }, 50);
      }

      // Handle end phase - end screen se zobrazí po skončení transition v transitionEndTimeoutRef
      if (phase !== "end" && prevPhase === "end") {
        // Reset end screen when leaving end phase
        endScreenTriggeredRef.current = false;
        setShowEndScreen(false);
        setShowEndScreenAfterTransition(false);
        if (endScreenTimeoutRef.current) {
          clearTimeout(endScreenTimeoutRef.current);
          endScreenTimeoutRef.current = null;
        }
      }

      // Aktualizovat previousPhaseRef až po zpracování změny fáze
      previousPhaseRef.current = phase;

      // Aktualizovat previousPlayersRef a previousMayorIdRef po detekci reveals
      // (aby se zachoval snapshot pro další přechod fáze)
      previousPlayersRef.current = currentPlayers.map((p) => ({
        _id: p._id,
        alive: p.alive,
      }));
      previousMayorIdRef.current = currentMayorId;
    }

    // Cleanup funkce pro zrušení všech timeoutů při změně fáze nebo unmountu
    // Musí být vždy vrácena, ne jen uvnitř podmínky pro animaci
    // DŮLEŽITÉ: Cleanup se spustí pouze při změně fáze, ne při každé změně gameState
    // Pouze zrušit timeouts, pokud se skutečně mění fáze (ne při každé změně gameState)
    return () => {
      // Cleanup se spustí pouze pokud se fáze změnila
      // (použijeme previousPhaseRef pro kontrolu)
      const currentPhase = phase;
      const prevPhase = previousPhaseRef.current;

      // Zrušit timeouts pouze pokud se fáze změnila nebo při unmountu
      if (prevPhase !== currentPhase || prevPhase === null) {
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = null;
        }
        if (transitionEndTimeoutRef.current) {
          clearTimeout(transitionEndTimeoutRef.current);
          transitionEndTimeoutRef.current = null;
        }
      }
    };
  }, [phase, gameState.players, gameState.game]); // Přidána závislost na gameState pro detekci reveals

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

  // Update phase ref whenever phase changes (without recreating SSE subscription)
  useEffect(() => {
    currentPhaseRef.current = phase;
  }, [phase]);

  // Real-time game state updates via Server-Sent Events
  useEffect(() => {
    if (!gameState?.game?._id) return;

    console.log("🔄 Starting SSE subscription for GameArena");

    // Subscribe to real-time game state updates
    const unsubscribe = gameApi.subscribeToGameState(gameState.game._id, async (freshState) => {
      try {
        // Use ref to get current phase value without causing subscription recreation
        const currentPhase = currentPhaseRef.current;
        if (freshState.game.phase !== currentPhase) {
          console.log(
            `🔄 [SYNC] Phase changed: ${currentPhase} → ${freshState.game.phase}`
          );

          // Animace se spustí automaticky přes hlavní useEffect při změně fáze

          if (onRefresh) {
            try {
              await onRefresh();
            } catch (refreshError) {
              console.error("❌ Error in onRefresh callback:", refreshError);
            }
          }
        }
      } catch (e) {
        console.error("❌ Error processing game state update:", e);
      }
    });

    return () => {
      console.log("🔄 Cleaning up SSE subscription");
      unsubscribe();
      if (endScreenTimeoutRef.current) {
        clearTimeout(endScreenTimeoutRef.current);
        endScreenTimeoutRef.current = null;
      }
    };
  }, [gameState.game._id, onRefresh]);

  const handleReturnToLobby = async () => {
    await gameApi.resetToLobby(gameState.game._id);
    await onRefresh();
  };

  // Pokud je hra u konce a end screen má být zobrazen, zobraz ho (i během transitionu)
  if (phase === "end" && showEndScreen) {
    return (
      <>
        {transition && (
          <PhaseTransition
            from={transition.from}
            to={transition.to}
            votingRevealData={votingRevealData}
            deadPlayers={deadPlayers}
          />
        )}
        <div
          style={{
            opacity: showEndScreenAfterTransition || !transition ? 1 : 0.3,
            transition: "opacity 0.5s ease-in",
            pointerEvents:
              showEndScreenAfterTransition || !transition ? "auto" : "none",
            position: "fixed",
            inset: 0,
            zIndex: transition ? 9999 : 10000,
          }}
        >
          <GameEndScreen
            gameState={gameState}
            onReturnToLobby={handleReturnToLobby}
            onReturnToMenu={onReturnToMenu}
          />
        </div>
      </>
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
        <PhaseTransition
          from={transition.from}
          to={transition.to}
          votingRevealData={votingRevealData}
          deadPlayers={deadPlayers}
        />
      )}
    </div>
  );
}

export default GameArena;
