import { disableTool } from "eve/tools";

// Keep the live-model acceptance fixture incapable of filesystem, network,
// shell, delegation, or human-input side effects.
export default disableTool();
