export { Landing } from "./components/landing";
/**
 * The client half of the node-colour contract: the stored colour **names**, and
 * the `--cc-*` custom property each maps onto. `server/graph/placement.ts` owns
 * the list of names and the server never stores a hex.
 *
 * It crosses the feature boundary because My Page's "My dot" tab names the same
 * palette the landing canvas draws, and two tables of the same colours would be
 * two things to re-skin.
 */
export {
  DEFAULT_NODE_COLOR_VAR,
  FALLBACK_NODE_COLOR_VAR,
  NODE_COLOR_VARS,
  type NodeColorName,
  nodeColorVar,
} from "./lib/neighbourhood-view";
