// src/components/moderator/GameArena/PlayersCircle.jsx
import React, { useMemo } from "react";
import PlayerToken from "./PlayerToken";
import "./PlayersCircle.css";

function PlayersCircle({ players, phase, game }) {
  const total = players.length;

  // spočítej počet hlasů pro každého cíle (jen pro denní fázi)
  // Respektuje voteWeight (starosta má 2 hlasy)
  const voteMap = useMemo(() => {
    if (phase !== "day") return {};
    const map = {};
    for (const p of players) {
      if (p.alive && p.voteFor) {
        const key = String(p.voteFor);
        const weight = p.voteWeight || 1;
        map[key] = (map[key] || 0) + weight;
      }
    }
    return map;
  }, [players, phase]);

  const safePadding = 140;
  const radiusPx = useMemo(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = Math.min(w, h) / 2 - safePadding;
    return Math.max(120, r);
  }, [players.length]);

  return (
    <div className="players-circle">
      {players.map((p, i) => {
        const angle = (i * (2 * Math.PI)) / (total || 1) - Math.PI / 2;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const x = centerX + radiusPx * Math.cos(angle);
        const y = centerY + radiusPx * Math.sin(angle);

        const votes = phase === "day" ? voteMap[String(p._id)] || 0 : 0;
        const isMayor =
          game?.mayor && game.mayor.toString() === p._id.toString();

        return (
          <PlayerToken
            key={p._id}
            player={p}
            phase={phase}
            votes={votes}
            isMayor={isMayor}
            style={{ left: `${x}px`, top: `${y}px` }}
          />
        );
      })}
    </div>
  );
}

export default PlayersCircle;
