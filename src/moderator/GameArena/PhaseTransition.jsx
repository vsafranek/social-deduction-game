// src/components/moderator/GameArena/PhaseTransition.jsx
import React from "react";
import "./PhaseTransition.css";

function PhaseTransition({ from, to, hiding, votingRevealData, deadPlayers }) {
  const isNightToDay = from === "night" && to === "day";
  const isDayToNight = from === "day" && (to === "night" || to === "end");
  const isEnd = to === "end";

  // Determine main text based on phase
  const getMainText = () => {
    if (isEnd) return "GAME ENDS";
    if (to === "day") return "DAY BREAKS";
    return "NIGHT FALLS";
  };

  // Determine subtitle
  const getSubtitle = () => {
    if (isEnd) return "The game has concluded";
    if (to === "day") return "Discuss and vote";
    return "Use your abilities";
  };

  // Render voting reveal info
  const renderVotingReveal = () => {
    if (!votingRevealData) return null;

    const isExecution = votingRevealData.type === "execution";
    const icon = isExecution ? "⚖️" : "🏛️";
    const message = isExecution
      ? "They have been voted out..."
      : "The new leader has been chosen...";

    return (
      <div
        className={`transition-reveal-info voting-reveal ${
          isExecution ? "execution" : ""
        }`}
      >
        <div className="reveal-icon">{icon}</div>
        <div className="reveal-text">
          {isExecution ? "EXECUTED" : "MAYOR ELECTED"}
        </div>
        <div className="transition-player-card">
          <div className="transition-avatar">
            {votingRevealData.player.avatar ? (
              <img
                src={votingRevealData.player.avatar}
                alt={votingRevealData.player.name}
                className="transition-avatar-img"
                onError={(e) => {
                  e.target.style.display = "none";
                  const fallback = e.target.nextElementSibling;
                  if (fallback) {
                    fallback.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className="transition-avatar-fallback"
              style={{
                display: votingRevealData.player.avatar ? "none" : "flex",
              }}
            >
              {votingRevealData.player.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="transition-player-name">
            {votingRevealData.player.name}
          </div>
        </div>
        <div className="reveal-message">{message}</div>
      </div>
    );
  };

  // Render death reveal info
  const renderDeathReveal = () => {
    console.log(
      `💀 [DEATH REVEAL RENDER] deadPlayers:`,
      deadPlayers,
      `length:`,
      deadPlayers?.length
    );
    if (!deadPlayers || deadPlayers.length === 0) return null;

    // Filter out executed players, if they're in voting reveal
    const executedPlayerId =
      votingRevealData?.type === "execution"
        ? votingRevealData.player?._id
        : null;
    // Only filter if executedPlayerId exists; otherwise return all dead players
    const filteredDeadPlayers = executedPlayerId
      ? deadPlayers.filter(
          (p) => p._id?.toString() !== executedPlayerId.toString()
        )
      : deadPlayers;

    if (filteredDeadPlayers.length === 0) return null;

    return (
      <div className="transition-reveal-info death-reveal">
        <div className="reveal-icon">💀</div>
        <div className="reveal-text">THE FALLEN</div>
        <div className="transition-players-list">
          {filteredDeadPlayers.map((player, idx) => (
            <div
              key={player._id}
              className="transition-player-card"
              style={{ animationDelay: `${idx * 0.2}s` }}
            >
              <div className="transition-avatar">
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="transition-avatar-img"
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fallback = e.target.nextElementSibling;
                      if (fallback) {
                        fallback.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className="transition-avatar-fallback"
                  style={{ display: player.avatar ? "none" : "flex" }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="transition-player-name">{player.name}</div>
            </div>
          ))}
        </div>
        <div className="reveal-message">They will be remembered...</div>
      </div>
    );
  };

  return (
    <div className={`phase-transition ${to} ${hiding ? "hiding" : ""}`}>
      <div className="transition-bg"></div>

      {isNightToDay && <div className="light-burst"></div>}

      {isDayToNight && (
        <>
          <div className="nightfall-particles"></div>
          <div className="darkness-veil"></div>
        </>
      )}

      <div className="transition-content">
        <div className="transition-icon">
          {isEnd ? (
            <img
              src="/icons/general/moon.svg"
              alt="End"
              className="transition-icon-img"
            />
          ) : to === "day" ? (
            <img
              src="/icons/general/day.svg"
              alt="Day"
              className="transition-icon-img"
            />
          ) : (
            <img
              src="/icons/general/moon.svg"
              alt="Night"
              className="transition-icon-img"
            />
          )}
        </div>
        <div className="transition-text">{getMainText()}</div>
        <div className="transition-subtitle">{getSubtitle()}</div>

        {/* Reveal information */}
        {votingRevealData && renderVotingReveal()}
        {/* Zobrazit death reveal vždy, když jsou mrtví hráči (i když je execution) */}
        {deadPlayers && deadPlayers.length > 0 && renderDeathReveal()}
      </div>
    </div>
  );
}

export default PhaseTransition;
