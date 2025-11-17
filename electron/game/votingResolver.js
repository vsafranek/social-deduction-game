// electron/game/votingResolver.js

/**
 * Voting resolution module
 * Handles day voting with majority rules:
 * - If player doesn't vote, it counts as vote AGAINST execution (abstain)
 * - Majority (>50%) is needed to execute
 * - Ties or insufficient votes = no execution
 */

async function resolveDayVoting(game, players, GameLog) {
  console.log('🗳️ [VotingResolver] Starting day voting resolution...');
  
  const alive = players.filter(p => p.alive);
  const totalAlive = alive.length;
  
  if (totalAlive === 0) {
    await GameLog.create({ gameId: game._id, message: 'No execution (no alive players).' });
    return { executed: null, reason: 'no_players' };
  }

  // Count votes per candidate
  const voteCounts = new Map(); // targetId -> vote count
  let votedCount = 0; // Počet lidí, kteří hlasovali
  
  for (const p of alive) {
    if (p.voteFor) {
      const key = p.voteFor.toString();
      voteCounts.set(key, (voteCounts.get(key) || 0) + 1);
      votedCount++;
    }
  }

  // If nobody voted for anyone
  if (voteCounts.size === 0) {
    await GameLog.create({ gameId: game._id, message: 'No execution (no votes cast).' });
    console.log('  ℹ️ No votes cast');
    return { executed: null, reason: 'no_votes' };
  }

  // Find player with most votes
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

  // Check for tie
  if (tied.length > 1) {
    const tiedNames = await Promise.all(
      tied.map(async id => {
        const p = await players.find(pl => pl._id.toString() === id);
        return p?.name || '?';
      })
    );
    await GameLog.create({ 
      gameId: game._id, 
      message: `No execution (tie: ${tiedNames.join(', ')})` 
    });
    console.log(`  ⚖️ Tie between: ${tiedNames.join(', ')}`);
    return { executed: null, reason: 'tie', tied };
  }

  // ✅ NOVÉ: Hlasování proti (nehlasující = against)
  const votesFor = topVotes;
  const votesAgainst = totalAlive - votesFor;
  const majorityThreshold = Math.floor(totalAlive / 2) + 1;

  console.log(`  📊 Voting stats:`);
  console.log(`     Total alive: ${totalAlive}`);
  console.log(`     Votes FOR execution: ${votesFor}`);
  console.log(`     Votes AGAINST (abstain): ${votesAgainst}`);
  console.log(`     Majority needed: ${majorityThreshold}`);

  // Pokud nemá většinu, neexekutuje se
  if (votesFor < majorityThreshold) {
    const target = players.find(p => p._id.toString() === topId);
    await GameLog.create({ 
      gameId: game._id, 
      message: `No execution (insufficient votes: ${votesFor}/${totalAlive} for ${target?.name})` 
    });
    console.log(`  ❌ Insufficient votes: ${votesFor}/${totalAlive} (need ${majorityThreshold})`);
    return { executed: null, reason: 'insufficient_votes', topCandidate: topId, votesFor };
  }

  // Má většinu → execute
  const target = players.find(p => p._id.toString() === topId);
  
  if (target && target.alive) {
    target.alive = false;
    await target.save();
    await GameLog.create({ 
      gameId: game._id, 
      message: `Executed: ${target.name} (${votesFor}/${totalAlive} votes)` 
    });
    console.log(`  ☠️ ${target.name} executed (${votesFor}/${totalAlive} votes)`);
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
    totalAlive 
  };
}

module.exports = {
  resolveDayVoting
};
