// src/player/PlayerView.jsx

import React, { useEffect, useState } from "react";
import { gameApi } from "../api/gameApi";
import { v4 as uuidv4 } from "uuid";
import LoginScreen from "./components/LoginScreen/LoginScreen";
import GameScreen from "./components/GameScreen/GameScreen";
import "./PlayerView.css";

function PlayerView() {
  const [step, setStep] = useState("login");
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const [sessionId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get("sessionId");

    if (urlSessionId) {
      console.log("🆔 Using sessionId from URL:", urlSessionId);
      return urlSessionId;
    }

    const urlRoomCode = urlParams.get("room");
    const forceNew = urlParams.get("newSession");
    const storageKey = `sessionId_${urlRoomCode || "default"}`;

    if (forceNew === "1") {
      const newId = uuidv4();
      console.log("🆔 TEST MODE: Created NEW session:", newId);
      localStorage.setItem(storageKey, newId);
      return newId;
    }

    let sid = localStorage.getItem(storageKey);
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem(storageKey, sid);
      console.log("🆔 Created NEW session:", sid);
    } else {
      console.log("🆔 Using EXISTING session:", sid);
    }

    return sid;
  });

  // Helper functions for localStorage
  const saveGameSession = (gameId, playerId, playerName, roomCode) => {
    const sessionData = {
      gameId,
      playerId,
      playerName,
      roomCode,
      sessionId,
      timestamp: Date.now(),
    };
    localStorage.setItem(
      `gameSession_${sessionId}`,
      JSON.stringify(sessionData)
    );
    console.log("💾 Saved game session to localStorage:", sessionData);
  };

  const loadGameSession = () => {
    const sessionDataStr = localStorage.getItem(`gameSession_${sessionId}`);
    if (!sessionDataStr) return null;

    try {
      const sessionData = JSON.parse(sessionDataStr);
      // Verify sessionId matches
      if (sessionData.sessionId !== sessionId) {
        console.log("🔄 SessionId mismatch, clearing saved session");
        localStorage.removeItem(`gameSession_${sessionId}`);
        return null;
      }
      console.log("💾 Loaded game session from localStorage:", sessionData);
      return sessionData;
    } catch (err) {
      console.error("❌ Error parsing saved session:", err);
      localStorage.removeItem(`gameSession_${sessionId}`);
      return null;
    }
  };

  const clearGameSession = () => {
    localStorage.removeItem(`gameSession_${sessionId}`);
    console.log("🗑️ Cleared game session from localStorage");
  };

  // Auto-join z URL parametrů nebo obnovení z localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomCode = urlParams.get("room");
    const urlPlayerName = urlParams.get("playerName");
    const forceNew = urlParams.get("newSession");

    // Pokud je forceNew, vymaž uloženou session
    if (forceNew === "1") {
      localStorage.removeItem(`gameSession_${sessionId}`);
    }

    // Zkus načíst uloženou session
    const sessionDataStr = localStorage.getItem(`gameSession_${sessionId}`);
    let savedSession = null;

    if (sessionDataStr && forceNew !== "1") {
      try {
        const parsed = JSON.parse(sessionDataStr);
        if (parsed.sessionId === sessionId) {
          savedSession = parsed;
        }
      } catch (err) {
        console.error("❌ Error parsing saved session:", err);
        localStorage.removeItem(`gameSession_${sessionId}`);
      }
    }

    if (savedSession) {
      // Máme uloženou session - zkus se automaticky připojit
      console.log("🔄 Attempting to restore game session...");
      setGameId(savedSession.gameId);
      setPlayerId(savedSession.playerId);
      setPlayerName(savedSession.playerName);
      setRoomCode(savedSession.roomCode);
      setStep("playing");
      setLoading(true);

      // Zkus se připojit zpět do hry
      gameApi
        .joinGameByCode(
          savedSession.roomCode,
          savedSession.playerName,
          sessionId
        )
        .then((result) => {
          if (result.error) {
            throw new Error(result.error);
          }

          // Ověř, že playerId odpovídá
          let currentPlayerId = result.playerId;
          if (
            result.playerId?.toString() !== savedSession.playerId?.toString()
          ) {
            console.warn("⚠️ PlayerId mismatch, updating...");
            setPlayerId(result.playerId);
            const updatedSession = {
              gameId: result.gameId,
              playerId: result.playerId,
              playerName: savedSession.playerName,
              roomCode: savedSession.roomCode,
              sessionId,
              timestamp: Date.now(),
            };
            localStorage.setItem(
              `gameSession_${sessionId}`,
              JSON.stringify(updatedSession)
            );
            // Update currentPlayerId to use the new ID from result
            currentPlayerId = result.playerId;
          }

          setGameId(result.gameId);
          setPlayerId(result.playerId);
          setLoading(false);

          // Načíst game state
          return gameApi.getGameState(result.gameId).then((data) => ({
            data,
            playerId: currentPlayerId,
          }));
        })
        .then(({ data, playerId }) => {
          // Ověř, že hráč stále existuje v hře
          // Use the current playerId (which may have been updated)
          if (data?.players) {
            const currentPlayerExists = data.players.some(
              (p) => p._id?.toString() === playerId?.toString()
            );

            if (currentPlayerExists) {
              setGameState(data);
              console.log("✅ Successfully restored game session");
            } else {
              throw new Error("Player not found in game");
            }
          } else {
            throw new Error("Invalid game state");
          }
        })
        .catch((err) => {
          console.error("❌ Failed to restore game session:", err);
          // Vymazat uloženou session a vrátit na login
          localStorage.removeItem(`gameSession_${sessionId}`);
          setStep("login");
          setGameId(null);
          setPlayerId(null);
          setGameState(null);
          setLoading(false);
          if (
            err.message?.includes("not found") ||
            err.message?.includes("404")
          ) {
            setError(
              "Hra byla ukončena nebo neexistuje. Prosím připoj se znovu."
            );
          } else {
            setError(
              "Nepodařilo se obnovit připojení. Prosím připoj se znovu."
            );
          }
        });
    } else {
      // Žádná uložená session - použij URL parametry
      if (urlRoomCode) {
        setRoomCode(urlRoomCode);
        console.log("🔑 Room code z URL:", urlRoomCode);
      }

      if (urlPlayerName) {
        setPlayerName(urlPlayerName);
        console.log("👤 Player name z URL:", urlPlayerName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Spustit pouze jednou při mountu

  // Automatické přihlášení z URL - pouze v Electronu (pro testování)
  // Tento useEffect se spustí pouze pokud jsme na login screen a nemáme uloženou session
  useEffect(() => {
    // Check if running in Electron
    const isElectron =
      typeof window !== "undefined" && window.electronAPI !== undefined;

    // Auto-login only in Electron (for testing with multiple windows)
    // Pouze pokud jsme na login screen a nemáme uloženou session
    const hasSavedSession = localStorage.getItem(`gameSession_${sessionId}`);
    if (
      isElectron &&
      playerName &&
      roomCode &&
      step === "login" &&
      !loading &&
      !hasSavedSession
    ) {
      console.log("🤖 Auto-login z URL (Electron test mode)");
      console.log("  SessionId:", sessionId);
      performLogin(playerName, roomCode);
    }
  }, [playerName, roomCode, step, loading, sessionId]);

  // Real-time game state updates via Server-Sent Events
  useEffect(() => {
    if (!gameId || !playerId) return;

    console.log(
      "🔄 Starting SSE subscription for game state with playerId:",
      playerId
    );

    // Subscribe to real-time game state updates
    const unsubscribe = gameApi.subscribeToGameState(
      gameId,
      (data) => {
        try {
          // Check if current player still exists in the game
          const currentPlayerExists = data?.players?.some(
            (p) => p._id?.toString() === playerId?.toString()
          );

          if (!currentPlayerExists && data?.game) {
            // Player was kicked from the game
            console.log(
              "🚪 Player was kicked from the game, returning to login screen"
            );
            // Preserve roomCode when returning to login screen
            const preservedRoomCode = data?.game?.roomCode || roomCode;
            if (preservedRoomCode && preservedRoomCode !== roomCode) {
              setRoomCode(preservedRoomCode);
            }
            // Vymazat uloženou session
            clearGameSession();
            setStep("login");
            setGameId(null);
            setPlayerId(null);
            setGameState(null);
            setError("Byl jsi vyhozen z lobby. Můžeš se připojit znovu.");
            unsubscribe();
            return;
          }

          setGameState(data);
        } catch (err) {
          console.error("❌ Error processing game state update:", err);
          // If game not found (404) or other error, game was likely deleted
          // Reset to login screen
          if (
            err.message?.includes("404") ||
            err.message?.includes("not found") ||
            err.message?.includes("Game not found")
          ) {
            console.log("🚪 Game was deleted, returning to login screen");
            // Vymazat uloženou session
            clearGameSession();
            setStep("login");
            setGameId(null);
            setPlayerId(null);
            setGameState(null);
            setError("Hra byla ukončena moderátorem. Prosím připoj se znovu.");
            unsubscribe();
          }
        }
      },
      (error) => {
        // Handle SSE connection errors (e.g., 404 when game doesn't exist)
        console.error("❌ SSE connection error:", error);
        console.log("🚪 Game connection failed, returning to login screen");
        // Vymazat uloženou session
        clearGameSession();
        setStep("login");
        setGameId(null);
        setPlayerId(null);
        setGameState(null);
        setError(
          "Hra byla ukončena moderátorem nebo neexistuje. Prosím připoj se znovu."
        );
        unsubscribe();
      }
    );

    // Cleanup on unmount or when gameId/playerId changes
    return () => {
      console.log("🔄 Cleaning up SSE subscription");
      unsubscribe();
    };
  }, [gameId, playerId]);

  const performLogin = async (name, room) => {
    if (!name.trim() || !room.trim()) {
      setError("Chybí jméno nebo room kód");
      return;
    }

    if (room.length !== 4 || !/^\d+$/.test(room)) {
      setError("Room kód musí být 4 číslice");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("🚪 Joining:", { room, name, sessionId });
      const result = await gameApi.joinGameByCode(room, name, sessionId);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      console.log("✅ Připojen!", {
        gameId: result.gameId,
        playerId: result.playerId,
      });

      setGameId(result.gameId);
      setPlayerId(result.playerId);
      setStep("playing");
      setError("");
      setLoading(false);

      // Uložit session do localStorage pro obnovení po refreshi
      saveGameSession(result.gameId, result.playerId, name, room);

      await fetchGameState();
    } catch (err) {
      setError("Nepodařilo se připojit.");
      console.error(err);
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await performLogin(playerName, roomCode);
  };

  const fetchGameState = async () => {
    if (!gameId) return;

    try {
      const data = await gameApi.getGameState(gameId);

      // Check if current player still exists in the game
      if (playerId && data?.players) {
        const currentPlayerExists = data.players.some(
          (p) => p._id?.toString() === playerId?.toString()
        );

        if (!currentPlayerExists) {
          // Player was kicked from the game
          console.log(
            "🚪 Player was kicked from the game, returning to login screen"
          );
          // Preserve roomCode when returning to login screen
          // Get roomCode from game state if available, otherwise keep current roomCode
          const preservedRoomCode = data?.game?.roomCode || roomCode;
          if (preservedRoomCode && preservedRoomCode !== roomCode) {
            setRoomCode(preservedRoomCode);
          }
          // Vymazat uloženou session
          clearGameSession();
          setStep("login");
          setGameId(null);
          setPlayerId(null);
          setGameState(null);
          setError("Byl jsi vyhozen z lobby. Můžeš se připojit znovu.");
          return;
        }
      }

      setGameState(data);
    } catch (error) {
      console.error("Chyba při načítání stavu:", error);
      // If game not found (404), game was likely deleted - return to login
      if (
        error.message?.includes("404") ||
        error.message?.includes("not found") ||
        error.message?.includes("Game not found")
      ) {
        console.log("🚪 Game was deleted, returning to login screen");
        // Vymazat uloženou session
        clearGameSession();
        setStep("login");
        setGameId(null);
        setPlayerId(null);
        setGameState(null);
        setError("Hra byla ukončena moderátorem. Prosím připoj se znovu.");
      }
      // Re-throw error so polling can handle it
      throw error;
    }
  };

  // ✅ UPDATED: Support actionMode parameter for dual-action roles and Witch control
  const handleNightAction = async (targetData, actionMode = null) => {
    try {
      console.log("🌙 Night action:", { playerId, targetData, actionMode });

      // Pokud je targetData objekt s puppetId a targetId (Witch), použij ho
      // Jinak je to normální targetId
      const targetId = targetData?.targetId || targetData;
      const puppetId = targetData?.puppetId || null;

      await gameApi.setNightAction(
        gameId,
        playerId,
        targetId,
        actionMode,
        puppetId
      );
      await fetchGameState();
    } catch (error) {
      console.error("Chyba při noční akci:", error);
      setError(error.message);
    }
  };

  const handleVote = async (targetId) => {
    try {
      // Optimistic update - okamžitě aktualizovat UI
      // targetId může být null (pro skip) nebo ID hráče
      if (gameState && gameState.players) {
        const updatedPlayers = gameState.players.map((p) => {
          if (p._id?.toString() === playerId?.toString()) {
            // Nastavit hasVoted: true a voteFor: targetId (může být null pro skip)
            return {
              ...p,
              hasVoted: true,
              voteFor: targetId || null, // Explicitně nastavit null pro skip
            };
          }
          return p;
        });
        setGameState({
          ...gameState,
          players: updatedPlayers,
        });
      }

      // Zavolat API v pozadí (neblokovat UI)
      setIsVoting(true);
      await gameApi.vote(gameId, playerId, targetId);
      setIsVoting(false);
      // Načíst skutečný stav ze serveru po úspěšném hlasování
      await fetchGameState();
    } catch (error) {
      console.error("Chyba při hlasování:", error);
      setError(error.message);
      setIsVoting(false);
      // Rollback optimistic update načtením skutečného stavu
      await fetchGameState();
    }
  };

  if (step === "login") {
    return (
      <LoginScreen
        playerName={playerName}
        roomCode={roomCode}
        loading={loading}
        error={error}
        onPlayerNameChange={setPlayerName}
        onRoomCodeChange={setRoomCode}
        onLogin={handleLogin}
      />
    );
  }

  if (!gameState) {
    return (
      <div className="player-loading-screen">
        <div className="loading-content-wrapper">
          <div className="loading-spinner-container">
            <div className="loading-spinner-outer"></div>
            <div className="loading-spinner-inner"></div>
            <div className="loading-spinner-core"></div>
          </div>
          <p className="loading-text">Načítání hry...</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Find current player
  const currentPlayer = gameState.players.find((p) => p._id === playerId);

  if (!currentPlayer) {
    return (
      <div className="player-loading-screen">
        <div className="loading-content-wrapper">
          <div className="loading-spinner-container">
            <div className="loading-spinner-outer"></div>
            <div className="loading-spinner-inner"></div>
            <div className="loading-spinner-core"></div>
          </div>
          <p className="loading-text">Načítání tvého profilu...</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  // Handler pro odchod z lobby
  const handleLeaveLobby = () => {
    // Vymazat uloženou session
    clearGameSession();
    // Vrátit na login screen
    setStep("login");
    setGameId(null);
    setPlayerId(null);
    setGameState(null);
    // Zachovat roomCode pro snadné znovupřipojení
    // playerName a roomCode zůstávají v state
  };

  // ✅ Pass currentPlayer to GameScreen
  return (
    <GameScreen
      gameState={gameState}
      currentPlayer={currentPlayer}
      playerName={currentPlayer.name} // ✅ Explicitly pass player name
      playerId={playerId}
      gameId={gameId}
      onNightAction={handleNightAction}
      onVote={handleVote}
      error={error}
      onRefresh={fetchGameState}
      isVoting={isVoting}
      onLeaveLobby={handleLeaveLobby}
    />
  );
}

export default PlayerView;
