# Games Phase 2 architecture

The authenticated Portal now exposes one Games destination while retaining the
existing `arcadeTab` identifier for compatible internal links. The page owns two
shallow segments: Faith Quest and FOG Arcade. Playable growth games were moved
from the Growth page into the Faith Quest segment; no game data or compatibility
routes were removed.

Authenticated play submits only through Phase 1 server-authoritative routes. The
server derives the member from the authenticated session, records raw game score
separately from Life Points, enforces the 5 LP Arcade and 25 LP growth-game daily
caps, and still records scores after either cap is reached. The client never uses
a supplied member identity to award LP.

The existing seeker route (`/?faith=quest`, its legacy typo alias, and
`/?play=arcade`) continues to serve `seeker-arcade.html`. It is intentionally a
separate public experience: public leaderboard submissions remain validated and
do not create Portal Life Point transactions. This preserves anonymous play
without embedding the public identity model inside authenticated Portal play.

Competitive views use each game's raw-score leaderboard from
`game_score_logs`. Scores from unlike games are never summed. Portal progression
leaderboards remain Life Point views. Game results show score, previous and
current personal best, dense rank (including visible ties), optional accuracy,
and the category's daily LP state as separate concepts.

The page uses one shared result renderer for all five canvas Arcade games and the
authenticated Faith Quest games. A reached LP cap changes only the reward copy;
Play Again remains available so personal bests and ranks can continue improving.
