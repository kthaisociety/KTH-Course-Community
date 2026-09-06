export { Landing } from "./components/landing";
/**
 * The client half of the node-appearance contract: the stored **names** on each
 * of the three axes, and what the canvas draws for each of them.
 * `server/graph/appearance.ts` owns the names and the server never stores a hex.
 *
 * It crosses the feature boundary because My Page's "My dot" tab shows the same
 * palette and the same shapes the landing canvas draws, and two tables of the
 * same appearance would be two things to re-skin.
 */
export {
  DEFAULT_NODE_COLOR_VAR,
  FALLBACK_NODE_COLOR_VAR,
  NO_SIGNAL,
  NODE_COLOR_VARS,
  type NodeColorName,
  nodeColorVar,
  nodeSignalStyleName,
  nodeStyleName,
} from "./lib/neighbourhood-view";
