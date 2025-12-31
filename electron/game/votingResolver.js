// electron/game/votingResolver.js

/**
 * Voting resolution module
 * Handles day voting with majority rules:
 * - First day (round 1): Vote for Mayor instead of execution
 * - Subsequent days: Vote for execution
 * - If player doesn't vote or skips, it counts as vote AGAINST execution (abstain)
 * - Majority (>50% of ALL votes) is needed to execute - includes skips and non-votes
 * - Ties or insufficient votes = no execution
 * - Mayor has 2 votes (vote_weight = 2)
 * - Total votes = sum of all weighted votes from all alive players (including skips)
 */

async function resolveDayVoting(game, players, createGameLog) {
  console.log("🗳️ [VotingResolver] Starting day voting resolution...");

  // Helper to get game ID (supports both id and _id for compatibility)
  const getGameId = (game) => {
    const id = game.id || game._id;
    return id && typeof id.toString === 'function' ? id.toString() : String(id);
  };
  const gameId = getGameId(game);

  const alive = players.filter((p) => p.alive);
  const totalAlive = alive.length;

  if (totalAlive === 0) {
    await createGameLog({
      game_id: gameId,
      message: "No execution (no alive players).",
    });
    return {
      executed: null,
      reason: "no_players",
      updates: { players: [], game: null },
    };
  }

  // Check if this is first day and no mayor has been elected yet
  const mayorId = game.mayor_id || game.mayor;
  const isFirstDayMayorElection = game.round === 1 && !mayorId;

  if (isFirstDayMayorElection) {
    console.log("  🏛️ First day - Mayor election instead of execution");
    return await resolveMayorElection(game, players, createGameLog);
  }

  // Normal execution voting
  return await resolveExecutionVoting(game, players, createGameLog);
}

async function resolveMayorElection(game, players, createGameLog) {
  // Helper to get game ID (supports both id and _id for compatibility)
  const getGameId = (game) => {
    const id = game.id || game._id;
    return id && typeof id.toString === 'function' ? id.toString() : String(id);
  };
  const gameId = getGameId(game);
  
  // Helper to get player ID (supports both id and _id for compatibility)
  const getPlayerId = (player) => {
    const id = player.id || player._id;
    return id && typeof id.toString === 'function' ? id.toString() : String(id);
  };
  
  const alive = players.filter((p) => p.alive);
  const totalAlive = alive.length;

  // Count votes per candidate (with vote weight)
  const voteCounts = new Map(); // targetId -> weighted vote count

  for (const p of alive) {
    if (p.vote_for_id) {
      const key = p.vote_for_id.toString();
      const weight = p.vote_weight || p.voteWeight || 1;
      voteCounts.set(key, (voteCounts.get(key) || 0) + weight);
    }
  }

  let topId = null;
  let topVotes = 0;
  const tied = [];

  // If nobody voted for anyone, all alive players are candidates
  if (voteCounts.size === 0) {
    console.log(
      "  ℹ️ No votes cast - selecting mayor randomly from all alive players"
    );
    await createGameLog({
      game_id: gameId,
      message: "No votes cast for mayor - selecting randomly",
    });

    // All alive players are tied with 0 votes
    for (const p of alive) {
      tied.push(getPlayerId(p));
    }
  } else {
    // Find player with most votes
    for (const [candidateId, voteCount] of voteCounts) {
      if (voteCount > topVotes) {
        topVotes = voteCount;
        topId = candidateId;
        tied.length = 0;
        tied.push(candidateId);
      } else if (voteCount === topVotes) {
        tied.push(candidateId);
      }
    }
  }

  // If there's a tie (or no votes), select randomly
  if (tied.length > 1) {
    const tiedNames = tied.map((id) => {
      const p = players.find((pl) => getPlayerId(pl) === id);
      return p?.name || "?";
    });

    // Random selection from tied candidates
    const randomIndex = Math.floor(Math.random() * tied.length);
    topId = tied[randomIndex];
    topVotes = voteCounts.get(topId) || 0;

    await createGameLog({
      game_id: gameId,
      message: `Tie for mayor (${tiedNames.join(", ")}) - ${
        players.find((p) => getPlayerId(p) === topId)?.name
      } selected randomly`,
    });
    console.log(
      `  ⚖️ Tie between: ${tiedNames.join(", ")} - randomly selected: ${
        players.find((p) => getPlayerId(p) === topId)?.name
      }`
    );
  } else if (tied.length === 1) {
    // Only one candidate (either from tie with 0 votes or single winner)
    topId = tied[0];
    topVotes = voteCounts.get(topId) || 0;
  }

  // Elect mayor
  const mayor = players.find((p) => getPlayerId(p) === topId);

  const playerUpdates = [];

  if (!mayor || !mayor.alive) {
    // Selected candidate is dead or doesn't exist - cannot elect mayor
    await createGameLog({
      game_id: gameId,
      message: `Cannot elect mayor - selected candidate is not alive`,
    });
    console.log(`  ❌ Cannot elect mayor - selected candidate is not alive`);

    // Clear daily votes
    for (const p of alive) {
      playerUpdates.push({
        id: p.id || p._id,
        updates: { has_voted: false, vote_for_id: null },
      });
    }

    return {
      executed: null,
      mayorElected: false,
      mayorId: null,
      mayorName: null,
      votesFor: topVotes,
      reason: "candidate_not_alive",
      updates: { players: playerUpdates, game: null },
    };
  }

  // Remove any existing modifier (overwrite passive role)
  if (mayor.modifier) {
    console.log(
      `  🔄 Removing existing modifier ${mayor.modifier} from ${mayor.name}`
    );
    await createGameLog({
      game_id: gameId,
      message: `${mayor.name}'s modifier ${mayor.modifier} was overwritten by Mayor role`,
    });
  }

  // Set mayor
  playerUpdates.push({
    id: mayor.id || mayor._id,
    updates: {
      modifier: null,
      vote_weight: 2,
    },
  });

  // Set mayor in game
  // POZNÁMKA: V databázi se používá mayor_id, ale v getGameState se vrací jako mayor
  const gameUpdates = {
    mayor_id: mayor.id || mayor._id,
  };
  console.log(`  🏛️ Setting mayor_id in game: ${mayor.id} (${mayor.name})`);

  const voteMessage =
    topVotes > 0
      ? `🏛️ ${mayor.name} was elected Mayor (${topVotes} weighted votes)`
      : `🏛️ ${mayor.name} was randomly selected as Mayor (no votes cast)`;

  await createGameLog({
    game_id: game.id,
    message: voteMessage,
  });
  console.log(`  🏛️ ${mayor.name} elected Mayor (${topVotes} weighted votes)`);

  // Clear daily votes
  for (const p of alive) {
    if (getPlayerId(p) !== getPlayerId(mayor)) {
      playerUpdates.push({
        id: p.id || p._id,
        updates: { has_voted: false, vote_for_id: null },
      });
    } else {
      // Mayor already in updates, just add vote reset
      const mayorUpdate = playerUpdates.find(
        (u) => {
          const updateId = u.id && typeof u.id.toString === 'function' ? u.id.toString() : String(u.id);
          return updateId === getPlayerId(mayor);
        }
      );
      if (mayorUpdate) {
        mayorUpdate.updates.has_voted = false;
        mayorUpdate.updates.vote_for_id = null;
      }
    }
  }

  return {
    executed: null,
    mayorElected: true,
    mayorId: mayor.id || mayor._id,
    mayorName: mayor.name,
    votesFor: topVotes,
    updates: {
      players: playerUpdates,
      game: { id: gameId, updates: gameUpdates },
    },
  };
}

async function resolveExecutionVoting(game, players, createGameLog) {
  // Helper to get game ID (supports both id and _id for compatibility)
  const getGameId = (game) => {
    const id = game.id || game._id;
    return id && typeof id.toString === 'function' ? id.toString() : String(id);
  };
  const gameId = getGameId(game);
  
  // Helper to get player ID (supports both id and _id for compatibility)
  const getPlayerId = (player) => {
    const id = player.id || player._id;
    return id && typeof id.toString === 'function' ? id.toString() : String(id);
  };
  
  const alive = players.filter((p) => p.alive);
  const totalAlive = alive.length;

  const voteCounts = new Map(); // targetId -> weighted vote count

  for (const p of alive) {
    // Support both vote_for_id and voteFor (for compatibility)
    const voteForId = p.vote_for_id || p.voteFor;
    if (voteForId) {
      // Pouze hlasy pro konkrétního hráče (skipy mají vote_for_id = null)
      const key = voteForId.toString();
      const weight = p.vote_weight || p.voteWeight || 1;
      voteCounts.set(key, (voteCounts.get(key) || 0) + weight);
    }
    // Skipy (vote_for_id = null) se přeskočí, ale jejich vote_weight se počítá do totalWeightedVotes
  }

  // If nobody voted for anyone
  if (voteCounts.size === 0) {
    await createGameLog({
      game_id: gameId,
      message: "No execution (no votes cast).",
    });
    console.log("  ℹ️ No votes cast");
    return {
      executed: null,
      reason: "no_votes",
      updates: { players: [], game: null },
    };
  }

  // Find player with most votes (using weighted votes)
  // Important: Tie detection uses weighted votes - if two candidates have same weighted votes, it's a tie
  // Example: 2 players vote against mayor (2 weighted votes), mayor votes against one of them (2 weighted votes) = 2v2 tie, no execution
  let topId = null;
  let topVotes = 0;
  const tied = [];

  for (const [candidateId, voteCount] of voteCounts) {
    if (voteCount > topVotes) {
      topVotes = voteCount;
      topId = candidateId;
      tied.length = 0;
      tied.push(candidateId);
    } else if (voteCount === topVotes) {
      tied.push(candidateId);
    }
  }

  // ✅ Check for tie in weighted votes - if two or more candidates have same weighted votes, no execution
  if (tied.length > 1) {
    const tiedNames = tied.map((id) => {
      const p = players.find((pl) => getPlayerId(pl) === id);
      return p?.name || "?";
    });

    // Log which players voted for each tied candidate
    const tieDetails = tied
      .map((candidateId) => {
        const voters = alive
          .filter(
            (p) => p.vote_for_id && p.vote_for_id.toString() === candidateId
          )
          .map(
            (p) =>
              `${p.name}${(p.vote_weight || p.voteWeight || 1) > 1 ? ` (${p.vote_weight || p.voteWeight || 1} votes)` : ""}`
          )
          .join(", ");
        const candidate = players.find((p) => getPlayerId(p) === candidateId);
        return `${candidate?.name || "?"} (${topVotes} votes: ${voters})`;
      })
      .join(" vs ");

    await createGameLog({
      game_id: gameId,
      message: `No execution (tie: ${tiedNames.join(
        ", "
      )} with ${topVotes} weighted votes each)`,
    });
    console.log(
      `  ⚖️ Tie between: ${tiedNames.join(
        ", "
      )} (${topVotes} weighted votes each)`
    );
    console.log(`     Details: ${tieDetails}`);
    return {
      executed: null,
      reason: "tie",
      tied,
      tiedVotes: topVotes,
      updates: { players: [], game: null },
    };
  }

  let totalWeightedVotes = 0;
  for (const p of alive) {
    totalWeightedVotes += p.vote_weight || p.voteWeight || 1;
  }

  const votesFor = topVotes;

  const votesAgainst = totalWeightedVotes - votesFor;

  // ✅ Většina se počítá z počtu živých hráčů, ne z celkového počtu vážených hlasů
  // Pokud je např. 3 živí hráči, většina je 2 hráči (více než 50% ze 3)
  // Starosta má 2 hlasy, ale počítá se jako 1 hráč při výpočtu většiny
  // majorityThreshold = počet hlasujících HRÁČŮ (ne vážených hlasů), které je potřeba pro většinu
  const majorityThreshold = Math.floor(totalAlive / 2) + 1;

  // Počítáme kolik HRÁČŮ hlasovalo pro top kandidáta
  // (ne kolik vážených hlasů - to už máme v topVotes)
  let playersVotingForTop = 0;
  for (const p of alive) {
    if (p.vote_for_id && p.vote_for_id.toString() === topId) {
      playersVotingForTop++;
    }
  }

  console.log(`  📊 Voting stats:`);
  console.log(`     Total alive players: ${totalAlive}`);
  console.log(`     Total weighted votes: ${totalWeightedVotes}`);
  console.log(`     Votes FOR execution (weighted): ${votesFor}`);
  console.log(`     Players voting FOR execution: ${playersVotingForTop}`);
  console.log(`     Votes AGAINST (skip/abstain/other): ${votesAgainst}`);
  console.log(
    `     Majority needed: ${majorityThreshold} players (more than 50% of ${totalAlive} alive players)`
  );

  // ✅ KONTROLA: Hráč může být vyloučen pouze pokud má nadpoloviční většinu z počtu živých HRÁČŮ
  // Např. 3 živí hráči → většina = 2 hráči (více než 50% ze 3)
  // Starosta s 2 hlasy se počítá jako 1 hráč při výpočtu většiny
  if (playersVotingForTop < majorityThreshold) {
    const target = players.find((p) => getPlayerId(p) === topId);
    await createGameLog({
      game_id: gameId,
      message: `No execution (insufficient votes: ${playersVotingForTop}/${totalAlive} players voted for ${target?.name}, need ${majorityThreshold})`,
    });
    console.log(
      `  ❌ Insufficient votes: ${playersVotingForTop}/${totalAlive} players (need ${majorityThreshold} players for majority)`
    );
    return {
      executed: null,
      reason: "insufficient_votes",
      topCandidate: topId,
      votesFor,
      playersVotingFor: playersVotingForTop,
      updates: { players: [], game: null },
    };
  }

  // Má většinu → execute
  const target = players.find((p) => getPlayerId(p) === topId);
  const playerUpdates = [];
  let gameUpdates = null;

  if (target && target.alive) {
    // If mayor is being executed, remove mayor status
    if (
      game.mayor &&
      (game.mayor_id || game.mayor).toString() === getPlayerId(target)
    ) {
      playerUpdates.push({
        id: target.id || target._id,
        updates: { vote_weight: 1, alive: false },
      });
      target.alive = false; // Aktualizovat také v paměti
      target.vote_weight = 1;
      target.voteWeight = 1; // Also set voteWeight for compatibility
      gameUpdates = { mayor_id: null };
      game.mayor_id = null;
      game.mayor = null; // Also set mayor for compatibility
      await createGameLog({
        game_id: gameId,
        message: `🏛️ Mayor ${target.name} was executed`,
      });
    } else {
      playerUpdates.push({
        id: target.id || target._id,
        updates: { alive: false },
      });
      target.alive = false; // Aktualizovat také v paměti
    }

    // ✅ Check if Jester was executed - special win condition
    if (target.role === "Jester") {
      await createGameLog({
        game_id: gameId,
        message: `🎭 Jester ${target.name} was executed - Jester wins!`,
      });
      console.log(`  🎭 ${target.name} (Jester) executed - Jester wins!`);

      // Clear daily votes
      for (const p of alive) {
        playerUpdates.push({
          id: p.id || p._id,
          updates: { has_voted: false, vote_for_id: null },
        });
        // Also update in-memory objects for test compatibility
        p.has_voted = false;
        p.hasVoted = false;
        p.vote_for_id = null;
        p.voteFor = null;
      }

      return {
        executed: target.id || target._id,
        executedName: target.name,
        votesFor,
        votesAgainst,
        totalAlive,
        jesterWin: true, // Special flag for Jester win
        updates: {
          players: playerUpdates,
          game: gameUpdates ? { id: gameId, updates: gameUpdates } : null,
        },
      };
    }

    await createGameLog({
      game_id: gameId,
      message: `Executed: ${target.name} (${playersVotingForTop}/${totalAlive} players, ${votesFor} weighted votes)`,
    });
    console.log(
      `  ☠️ ${target.name} executed (${playersVotingForTop}/${totalAlive} players, ${votesFor} weighted votes)`
    );

    // ✅ Sweetheart death effect
    if (target.modifier === "Sweetheart") {
      const candidates = players.filter(
        (p) =>
          p.alive &&
          p.modifier !== "Drunk" &&
          p.modifier !== "Sweetheart" &&
          getPlayerId(p) !== getPlayerId(target)
      );
      if (candidates.length > 0) {
        const victim =
          candidates[Math.floor(Math.random() * candidates.length)];
        playerUpdates.push({
          id: victim.id || victim._id,
          updates: { modifier: "Drunk" },
        });
        // Also update in-memory object for test compatibility
        victim.modifier = "Drunk";
        await createGameLog({
          game_id: gameId,
          message: `🍺 Sweetheart died... someone became Drunk!`,
        });
        console.log(
          `  🍺 Sweetheart ${target.name} executed... ${victim.name} became Drunk!`
        );
      }
    }
  }

  // Clear daily votes
  for (const p of alive) {
    const playerId = getPlayerId(p);
    const existingUpdate = playerUpdates.find((u) => {
      const updateId = u.id && typeof u.id.toString === 'function' ? u.id.toString() : String(u.id);
      return updateId === playerId;
    });
    if (!existingUpdate) {
      playerUpdates.push({
        id: p.id || p._id,
        updates: { has_voted: false, vote_for_id: null },
      });
    } else {
      const existing = existingUpdate;
      existing.updates.has_voted = false;
      existing.updates.vote_for_id = null;
    }
    // Also update in-memory objects for test compatibility
    p.has_voted = false;
    p.hasVoted = false;
    p.vote_for_id = null;
    p.voteFor = null;
  }

  return {
    executed: target ? (target.id || target._id) : null,
    executedName: target?.name || null,
    votesFor,
    votesAgainst,
    totalAlive,
    playersVotingFor: playersVotingForTop,
    updates: {
      players: playerUpdates,
      game: gameUpdates ? { id: gameId, updates: gameUpdates } : null,
    },
  };
}

module.exports = {
  resolveDayVoting,
};
