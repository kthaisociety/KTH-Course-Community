import { backfillCommunityGraphPlacements } from "../server/graph/service";

/**
 * Place the app users the two live placement paths never reached.
 *
 * Sign-up places an account and a member's own first read repairs one, so the
 * people left over are those who joined before the community graph existed and
 * those whose sign-up hook swallowed a failure — real accounts with no dot on
 * the hero, and no way to get one until they next sign in.
 *
 * A one-off, but safe to re-run: joining is idempotent, so a second run finds
 * nobody unplaced and writes nothing. Run it after deploying the graph, and
 * again any time the hero looks shorter than the membership.
 */
async function main() {
  const { placed } = await backfillCommunityGraphPlacements();
  console.log(
    placed === 0
      ? "Every app user already has a node; nothing to place."
      : `Placed ${placed} app users in the community graph.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
