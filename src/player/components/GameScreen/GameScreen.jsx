// src/player/components/GameScreen/GameScreen.jsx
import React, { useMemo, useState, useEffect } from 'react';
import RoleCard from '../RoleCard/RoleCard';
import NightPhase from '../NightPhase/NightPhase';
import DayPhase from '../DayPhase/DayPhase';
import NightResultsStories from '../NightResultsStories/NightResultsStories';
import NightResults from '../NightResults/NightResults';
import VotingModal from '../VotingModal/VotingModal';
import './GameScreen.css';

function GameScreen({
  playerName,
  gameState,
  playerId,
  currentPlayer,
  onNightAction,
  onVote,
  error,
  onErrorDismiss
}) {
  const [showStories, setShowStories] = useState(false);
  const [storiesShown, setStoriesShown] = useState(false);
  const [previousPhase, setPreviousPhase] = useState(null);
  const [showVotingModal, setShowVotingModal] = useState(false);
  
  const phase = gameState?.game?.phase;

  const aliveCount = useMemo(
    () => gameState?.players?.filter(p => p.alive).length || 0,
    [gameState]
  );

  const alivePlayers = useMemo(
    () => gameState?.players?.filter(p => p.alive) || [],
    [gameState]
  );

  const hasNightResults = currentPlayer?.nightResults && 
                         currentPlayer.nightResults.length > 0;

  // Zobraz stories při přechodu z noci
  useEffect(() => {
    const transitionedFromNight = previousPhase === 'night' && 
                                  (phase === 'day' || phase === 'end');
    
    if (transitionedFromNight && hasNightResults && !storiesShown) {
      setShowStories(true);
      setStoriesShown(true);
    }
    
    if (previousPhase === 'day' && phase === 'night') {
      setStoriesShown(false);
      setShowStories(false);
    }

    setPreviousPhase(phase);
  }, [phase, hasNightResults, storiesShown, previousPhase]);

  if (!currentPlayer) {
    return <div className="game-loading">Načítání tvého profilu...</div>;
  }

  const handleStoriesComplete = () => {
    setShowStories(false);
  };

  const handleVoteSubmit = async (targetId) => {
    await onVote(targetId);
    setShowVotingModal(false);
  };

  // Zjisti, jestli už hlasoval
  const hasVoted = currentPlayer.hasVoted || currentPlayer.voteFor;
  // Pokud hlasoval a má voteFor, najdi hráče, jinak null (skip nebo nehlasoval)
  const votedPlayer = hasVoted && currentPlayer.voteFor
    ? gameState.players.find(p => p._id === currentPlayer.voteFor)
    : null;

  // Zobraz stories přes vše
  if (showStories && hasNightResults) {
    return (
      <NightResultsStories 
        results={currentPlayer.nightResults}
        onComplete={handleStoriesComplete}
      />
    );
  }

  // End screen
  if (phase === 'end') {
    const winner = gameState?.game?.winner;
    const winnerIds = (gameState?.game?.winnerPlayerIds || []).map(id => id?.toString?.() ?? id);
    const currentId = currentPlayer?._id?.toString();
    const playerWon = currentId ? winnerIds.includes(currentId) : false;
    
    // Check if custom winner (Jester or Infected)
    const isCustomWin = winner === 'custom';
    const customWinner = isCustomWin ? gameState.players.find(p => winnerIds.includes(p._id?.toString?.() ?? p._id)) : null;
    const isJesterWin = isCustomWin && customWinner?.role === 'Jester';
    const isInfectedWin = isCustomWin && customWinner?.role === 'Infected';
    
    let personalResult;
    let victoryMessage;
    
    if (isJesterWin && customWinner) {
      if (playerWon) {
        personalResult = 'Vyhrál jsi! 🎭';
        victoryMessage = 'Byl jsi vyhlasován a vyhrál jsi jako Šašek!';
      } else {
        personalResult = 'Prohrál jsi.';
        victoryMessage = `Šašek ${customWinner.name} byl vyhlasován a vyhrál!`;
      }
    } else if (isInfectedWin && customWinner) {
      if (playerWon) {
        personalResult = 'Vyhrál jsi! 🦠';
        victoryMessage = 'Všichni hráči byli nakaženi - vyhrál jsi jako Nakažený!';
      } else {
        personalResult = 'Prohrál jsi.';
        victoryMessage = `Nakažený ${customWinner.name} vyhrál - všichni hráči byli nakaženi!`;
      }
    } else {
      personalResult = playerWon ? 'Vyhrál jsi! 🎉' : 'Prohrál jsi.';
      victoryMessage = null;
    }
    
    return (
      <div className="game-screen phase-end">
        <div className="end-screen">
          <h1>Hra skončila!</h1>
          <h2>{personalResult}</h2>
          {victoryMessage && (
            <p className="victory-message" style={{ 
              marginTop: '8px', 
              fontSize: '16px', 
              color: '#a855f7',
              fontWeight: '600'
            }}>
              {victoryMessage}
            </p>
          )}
          <p className="player-role">Role: {currentPlayer.modifier === 'Amnesiac' ? 'Neznámá' : currentPlayer.role}</p>
          <p className="player-status">
            {currentPlayer.alive ? '✅ Přežil jsi' : '💀 Zemřel jsi'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`game-screen phase-${phase}`}>
      <header className="game-header-compact">
        <div className="header-left">
          <h1 className="player-name">{playerName}</h1>
          <div className={`phase-badge ${phase}`}>
            {phase === 'lobby' && '🎪 Lobby'}
            {phase === 'day' && '☀️ Den'}
            {phase === 'night' && '🌙 Noc'}
          </div>
        </div>
        
        <div className="header-right">
          <div className="alive-indicators">
            {gameState.players.map(p => (
              <span 
                key={p._id} 
                className={`player-dot ${p.alive ? 'alive' : 'dead'}`}
                title={p.name}
              >
                {p.alive ? '●' : '○'}
              </span>
            ))}
          </div>
          <div className="alive-count">{aliveCount}</div>
        </div>
      </header>

      <main className="game-main">
        <RoleCard player={currentPlayer} gameState={gameState} />

        {/* Výsledky po stories */}
        {phase === 'day' && hasNightResults && !showStories && (
          <NightResults 
            player={currentPlayer} 
            results={currentPlayer.nightResults}
          />
        )}

        {/* Noční akce */}
        {phase === 'night' && currentPlayer.alive && (
          <NightPhase
            player={currentPlayer}
            players={gameState.players}
            onAction={onNightAction}
          />
        )}

        {/* ✅ Denní hlasování - jen tlačítko */}
        {phase === 'day' && currentPlayer.alive && (
          <DayPhase
            onOpenVoting={() => setShowVotingModal(true)}
            hasVoted={hasVoted}
            votedPlayerName={votedPlayer?.name}
            isMayorElection={gameState?.game?.round === 1 && !gameState?.game?.mayor}
          />
        )}
      </main>

      {/* ✅ Voting Modal */}
      {showVotingModal && (
        <VotingModal
          players={alivePlayers}
          onVote={handleVoteSubmit}
          onClose={() => setShowVotingModal(false)}
          isMayorElection={gameState?.game?.round === 1 && !gameState?.game?.mayor}
        />
      )}

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={onErrorDismiss}>✕</button>
        </div>
      )}
    </div>
  );
}

export default GameScreen;
