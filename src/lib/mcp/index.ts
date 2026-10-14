import { defineMcp } from "@lovable.dev/mcp-js";
import getEvent from "./tools/get-event";
import listTracks from "./tools/list-tracks";
import listTeams from "./tools/list-teams";
import getResults from "./tools/get-results";

export default defineMcp({
  name: "pitchperfect-judge-vote",
  title: "Pitchperfect Judge Vote",
  version: "0.1.0",
  instructions: "Read-only public information for the hackathon judging hub: event details and phase, tracks with open-data sources, teams, and results once published.",
  tools: [getEvent, listTracks, listTeams, getResults],
});
