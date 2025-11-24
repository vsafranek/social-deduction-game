// src/player/components/RoleCard/RoleCard.jsx
import React, { useState } from 'react';
import './RoleCard.css';

const ROLE_INFO = {
  'Doctor': { emoji: '💉', team: 'good', teamLabel: 'Město', description: 'Každou noc chráníš jednoho hráče před smrtí', actionVerb: 'Chránit' },
  'Jailer': { emoji: '👮', team: 'good', teamLabel: 'Město', description: 'Každou noc uzamkneš jednoho hráče - nemůže provést akci', actionVerb: 'Uzamknout' },
  'Investigator': { emoji: '🔍', team: 'good', teamLabel: 'Město', description: 'Zjišťuješ dvě možné role cílového hráče (jedna je správná)', actionVerb: 'Vyšetřit' },
  'Lookout': { emoji: '👁️', team: 'good', teamLabel: 'Město', description: 'Sleduj dům hráče a uvidíš, kdo ho navštívil', actionVerb: 'Pozorovat' },
  'Trapper': { emoji: '🪤', team: 'good', teamLabel: 'Město', description: 'Nastav past u svého domu - návštěvníci jsou odhaleni', actionVerb: 'Nastavit past' },
  'Tracker': { emoji: '👣', team: 'good', teamLabel: 'Město', description: 'Sleduj hráče a zjisti, kam šel', actionVerb: 'Sledovat' },
  'Citizen': { emoji: '👤', team: 'good', teamLabel: 'Město', description: 'Obyčejný občan bez speciální schopnosti', actionVerb: 'Žádná' },
  'Killer': { emoji: '🔪', team: 'evil', teamLabel: 'Mafie', description: 'Každou noc zabíjíš jednoho hráče', actionVerb: 'Zabít' },
  'Cleaner': { emoji: '🧹', team: 'evil', teamLabel: 'Mafie', description: 'Zabíjíš a skrýváš roli oběti', actionVerb: 'Zabít a vyčistit' },
  'Framer': { emoji: '🖼️', team: 'evil', teamLabel: 'Mafie', description: 'Zarámuj hráče - bude vypadat jako zločinec', actionVerb: 'Zarámovat' },
  'Diplomat': { emoji: '🕊️', team: 'neutral', teamLabel: 'Neutrální', description: 'Můžeš vyhrát s oběma stranami', actionVerb: 'Žádná' },
  'Survivor': { emoji: '🛡️', team: 'neutral', teamLabel: 'Sériový vrah', description: 'Zabíjej všechny - vyhraj sám', actionVerb: 'Zabít' },
  'Infected': { emoji: '🦠', team: 'neutral', teamLabel: 'Nakažlivý', description: 'Nakaz všechny hráče a vyhraj', actionVerb: 'Nakazit' }
};

function RoleCard({ player, gameState }) {
  const [expanded, setExpanded] = useState(false);
  const role = player.role || 'Citizen';
  const roleData = ROLE_INFO[role] || ROLE_INFO['Citizen'];
  const isMayor = gameState?.game?.mayor && gameState.game.mayor.toString() === player._id.toString();

  return (
    <div className={`role-card ${expanded ? 'expanded' : ''} ${roleData.team} ${!player.alive ? 'dead' : ''}`}>
      <button
        className="role-card-button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="role-header">
          <span className="role-emoji">{roleData.emoji}</span>
          <div className="role-name-status">
            <h2>{role}</h2>
            {isMayor && (
              <p className="mayor-indicator">🏛️ Starosta</p>
            )}
            <p className={`team-label ${roleData.team}`}>
              {roleData.teamLabel}
            </p>
            <p className={`status ${player.alive ? 'alive' : 'dead'}`}>
              {player.alive ? '✅ Živý' : '💀 Mrtvý'}
            </p>
          </div>
          <span className={`expand-icon ${expanded ? 'open' : ''}`}>▼</span>
        </div>

        {expanded && (
          <div className="role-details">
            <div className="role-description">
              <p>{roleData.description}</p>
            </div>

            {isMayor && (
              <div className="role-mayor">
                <h4>🏛️ Starosta</h4>
                <p className="mayor-info">Jsi zvolený starosta - moderuješ hru a máš 2 hlasy</p>
              </div>
            )}

            {player.modifier && (
              <div className="role-modifier">
                <h4>⚠️ Modifikátor: {player.modifier}</h4>
                <p className="modifier-warning">Tvoje schopnost je ovlivněna!</p>
              </div>
            )}

            <div className="role-footer">
              <p className="action-label">Noční akce: <strong>{roleData.actionVerb}</strong></p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}

export default RoleCard;
