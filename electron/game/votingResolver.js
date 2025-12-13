// electron/game/votingResolver.js

/**
 * Voting resolution module
 * Handles day voting with majority rules:
 * - First day (round 1): Vote for Mayor instead of execution
 * - Subsequent days: Vote for execution
 * - If player doesn't vote or skips, it counts as vote AGAINST execution (abstain)
 * - Majority (>50% of ALL votes) is needed to execute - includes skips and non-votes
 * - Ties or insufficient votes = no execution
 * - Mayor has 2 votes (voteWeight = 2)
 * - Total votes = sum of all weighted votes from all alive players (including skips)
 */

async function resolveDayVoting(game, players, GameLog) {
  console.log('🗳️ [VotingResolver] Starting day voting resolution...');

  const alive = players.filter(p => p.alive);
  const totalAlive = alive.length;

  if (totalAlive === 0) {
    await GameLog.create({ gameId: game._id, message: 'No execution (no alive players).' });
    return { executed: null, reason: 'no_players' };
  }

  // Check if this is first day and no mayor has been elected yet
  const isFirstDayMayorElection = game.round === 1 && !game.mayor;

  if (isFirstDayMayorElection) {
    console.log('  🏛️ First day - Mayor election instead of execution');
    return await resolveMayorElection(game, players, GameLog);
  }

  // Normal execution voting
  return await resolveExecutionVoting(game, players, GameLog);
}

async function resolveMayorElection(game, players, GameLog) {
  const alive = players.filter(p => p.alive);
  const totalAlive = alive.length;

  // Count votes per candidate (with vote weight)
  const voteCounts = new Map(); // targetId -> weighted vote count

  for (const p of alive) {
    if (p.voteFor) {
      const key = p.voteFor.toString();
      const weight = p.voteWeight || 1;
      voteCounts.set(key, (voteCounts.get(key) || 0) + weight);
    }
  }

  let topId = null;
  let topVotes = 0;
  const tied = [];

  // If nobody voted for anyone, all alive players are candidates
  if (voteCounts.size === 0) {
    console.log('  ℹ️ No votes cast - selecting mayor randomly from all alive players');
    await GameLog.create({
      gameId: game._id,
      message: 'No votes cast for mayor - selecting randomly'
    });

    // All alive players are tied with 0 votes
    for (const p of alive) {
      tied.push(p._id.toString());
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
    const tiedNames = tied.map(id => {
      const p = players.find(pl => pl._id.toString() === id);
      return p?.name || '?';
    });

    // Random selection from tied candidates
    const randomIndex = Math.floor(Math.random() * tied.length);
    topId = tied[randomIndex];
    topVotes = voteCounts.get(topId) || 0;

    await GameLog.create({
      gameId: game._id,
      message: `Tie for mayor (${tiedNames.join(', ')}) - ${players.find(p => p._id.toString() === topId)?.name} selected randomly`
    });
    console.log(`  ⚖️ Tie between: ${tiedNames.join(', ')} - randomly selected: ${players.find(p => p._id.toString() === topId)?.name}`);
  } else if (tied.length === 1) {
    // Only one candidate (either from tie with 0 votes or single winner)
    topId = tied[0];
    topVotes = voteCounts.get(topId) || 0;
  }

  // Elect mayor
  const mayor = players.find(p => p._id.toString() === topId);

  if (!mayor || !mayor.alive) {
    // Selected candidate is dead or doesn't exist - cannot elect mayor
    await GameLog.create({
      gameId: game._id,
      message: `Cannot elect mayor - selected candidate is not alive`
    });
    console.log(`  ❌ Cannot elect mayor - selected candidate is not alive`);

    // Clear daily votes
    for (const p of alive) {
      p.hasVoted = false;
      p.voteFor = null;
      await p.save();
    }

    return {
      executed: null,
      mayorElected: false,
      mayorId: null,
      mayorName: null,
      votesFor: topVotes,
      reason: 'candidate_not_alive'
    };
  }

  // Remove any existing modifier (overwrite passive role)
  if (mayor.modifier) {
    console.log(`  🔄 Removing existing modifier ${mayor.modifier} from ${mayor.name}`);
    await GameLog.create({
      gameId: game._id,
      message: `${mayor.name}'s modifier ${mayor.modifier} was overwritten by Mayor role`
    });
  }

  // Set mayor
  mayor.modifier = null; // Overwrite any existing modifier
  mayor.voteWeight = 2; // Mayor has 2 votes
  await mayor.save();

  // Set mayor in game
  game.mayor = mayor._id;
  await game.save();

  const voteMessage = topVotes > 0
    ? `🏛️ ${mayor.name} was elected Mayor (${topVotes} weighted votes)`
    : `🏛️ ${mayor.name} was randomly selected as Mayor (no votes cast)`;

  await GameLog.create({
    gameId: game._id,
    message: voteMessage
  });
  console.log(`  🏛️ ${mayor.name} elected Mayor (${topVotes} weighted votes)`);

  // Clear daily votes
  for (const p of alive) {
    p.hasVoted = false;
    p.voteFor = null;
    await p.save();
  }

  return {
    executed: null,
    mayorElected: true,
    mayorId: mayor._id,
    mayorName: mayor.name,
    votesFor: topVotes
  };
}

async function resolveExecutionVoting(game, players, GameLog) {
  const alive = players.filter(p => p.alive);
  const totalAlive = alive.length;


  const voteCounts = new Map(); // targetId -> weighted vote count

  for (const p of alive) {
    if (p.voteFor) {
      // Pouze hlasy pro konkrétního hráče (skipy mají voteFor = null)
      const key = p.voteFor.toString();
      const weight = p.voteWeight || 1;
      voteCounts.set(key, (voteCounts.get(key) || 0) + weight);
    }
    // Skipy (voteFor = null) se přeskočí, ale jejich voteWeight se počítá do totalWeightedVotes
  }

  // If nobody voted for anyone
  if (voteCounts.size === 0) {
    await GameLog.create({ gameId: game._id, message: 'No execution (no votes cast).' });
    console.log('  ℹ️ No votes cast');
    return { executed: null, reason: 'no_votes' };
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
    const tiedNames = tied.map(id => {
      const p = players.find(pl => pl._id.toString() === id);
      return p?.name || '?';
    });

    // Log which players voted for each tied candidate
    const tieDetails = tied.map(candidateId => {
      const voters = alive
        .filter(p => p.voteFor && p.voteFor.toString() === candidateId)
        .map(p => `${p.name}${p.voteWeight > 1 ? ` (${p.voteWeight} votes)` : ''}`)
        .join(', ');
      const candidate = players.find(p => p._id.toString() === candidateId);
      return `${candidate?.name || '?'} (${topVotes} votes: ${voters})`;
    }).join(' vs ');

    await GameLog.create({
      gameId: game._id,
      message: `No execution (tie: ${tiedNames.join(', ')} with ${topVotes} weighted votes each)`
    });
    console.log(`  ⚖️ Tie between: ${tiedNames.join(', ')} (${topVotes} weighted votes each)`);
    console.log(`     Details: ${tieDetails}`);
    return { executed: null, reason: 'tie', tied, tiedVotes: topVotes };
  }

  let totalWeightedVotes = 0;
  for (const p of alive) {
    totalWeightedVotes += (p.voteWeight || 1);
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
    if (p.voteFor && p.voteFor.toString() === topId) {
      playersVotingForTop++;
    }
  }

  console.log(`  📊 Voting stats:`);
  console.log(`     Total alive players: ${totalAlive}`);
  console.log(`     Total weighted votes: ${totalWeightedVotes}`);
  console.log(`     Votes FOR execution (weighted): ${votesFor}`);
  console.log(`     Players voting FOR execution: ${playersVotingForTop}`);
  console.log(`     Votes AGAINST (skip/abstain/other): ${votesAgainst}`);
  console.log(`     Majority needed: ${majorityThreshold} players (more than 50% of ${totalAlive} alive players)`);

  // ✅ KONTROLA: Hráč může být vyloučen pouze pokud má nadpoloviční většinu z počtu živých HRÁČŮ
  // Např. 3 živí hráči → většina = 2 hráči (více než 50% ze 3)
  // Starosta s 2 hlasy se počítá jako 1 hráč při výpočtu většiny
  if (playersVotingForTop < majorityThreshold) {
    const target = players.find(p => p._id.toString() === topId);
    await GameLog.create({
      gameId: game._id,
      message: `No execution (insufficient votes: ${playersVotingForTop}/${totalAlive} players voted for ${target?.name}, need ${majorityThreshold})`
    });
    console.log(`  ❌ Insufficient votes: ${playersVotingForTop}/${totalAlive} players (need ${majorityThreshold} players for majority)`);
    return { executed: null, reason: 'insufficient_votes', topCandidate: topId, votesFor, playersVotingFor: playersVotingForTop };
  }

  // Má většinu → execute
  const target = players.find(p => p._id.toString() === topId);

  if (target && target.alive) {
    // If mayor is being executed, remove mayor status
    if (game.mayor && game.mayor.toString() === target._id.toString()) {
      target.voteWeight = 1; // Remove mayor vote weight
      game.mayor = null; // No new mayor can be elected
      await game.save();
      await GameLog.create({
        gameId: game._id,
        message: `🏛️ Mayor ${target.name} was executed`
      });
    }

    // ✅ Check if Jester was executed - special win condition
    if (target.role === 'Jester') {
      target.alive = false;
      await target.save();
      await GameLog.create({
        gameId: game._id,
        message: `🎭 Jester ${target.name} was executed - Jester wins!`
      });
      console.log(`  🎭 ${target.name} (Jester) executed - Jester wins!`);

      // Clear daily votes
      for (const p of alive) {
        p.hasVoted = false;
        p.voteFor = null;
        await p.save();
      }

      return {
        executed: target._id,
        executedName: target.name,
        votesFor,
        votesAgainst,
        totalAlive,
        jesterWin: true // Special flag for Jester win
      };
    }

    target.alive = false;
    await target.save();
    await GameLog.create({
      gameId: game._id,
      message: `Executed: ${target.name} (${playersVotingForTop}/${totalAlive} players, ${votesFor} weighted votes)`
    });
    console.log(`  ☠️ ${target.name} executed (${playersVotingForTop}/${totalAlive} players, ${votesFor} weighted votes)`);

    // ✅ Sweetheart death effect
    if (target.modifier === 'Sweetheart') {
      const candidates = players.filter(p => p.alive && p.modifier !== 'Drunk' && p.modifier !== 'Sweetheart' && p._id.toString() !== target._id.toString());
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        victim.modifier = 'Drunk';
        await victim.save();
        await GameLog.create({
          gameId: game._id,
          message: `🍺 Sweetheart died... someone became Drunk!`
        });
        console.log(`  🍺 Sweetheart ${target.name} executed... ${victim.name} became Drunk!`);
      }
    }
  }

  // Clear daily votes
  for (const p of alive) {
    p.hasVoted = false;
    p.voteFor = null;
    await p.save();
  }

  return {
    executed: target?._id || null,
    executedName: target?.name || null,
    votesFor,
    votesAgainst,
    totalAlive,
    playersVotingFor: playersVotingForTop
  };
}

module.exports = {
  resolveDayVoting
};