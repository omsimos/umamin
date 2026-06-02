import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sweep ended matches",
  { seconds: 120 },
  internal.cleanup.sweepEndedMatches,
  {},
);
crons.interval(
  "sweep stale queue",
  { seconds: 120 },
  internal.cleanup.sweepStaleQueue,
  {},
);
crons.interval(
  "sweep dead sessions",
  { seconds: 300 },
  internal.cleanup.sweepDeadSessions,
  {},
);

export default crons;
