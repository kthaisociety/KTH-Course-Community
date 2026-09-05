import { backfillEarnedPersonalizationTiers } from "../server/graph/service";

/**
 * Give app users who contributed before the tier writer existed the tier they
 * already earned.
 *
 * A one-off, but safe to re-run: the recompute is derived and the write only
 * ever raises, so a second run reports zero raises and changes nothing. Run it
 * once after the writer ships, and again any time the column looks wrong.
 */
async function main() {
  const { scanned, raised } = await backfillEarnedPersonalizationTiers();
  console.log(
    `Recomputed the earned personalization tier for ${scanned} contributors; ${raised} were raised.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
