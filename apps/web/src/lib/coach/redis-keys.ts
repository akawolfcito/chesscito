export const REDIS_KEYS = {
  game: (wallet: string, gameId: string) => `coach:game:${wallet}:${gameId}`,
  gameList: (wallet: string) => `coach:games:${wallet}`,
  job: (jobId: string) => `coach:job:${jobId}`,
  jobByGame: (wallet: string, gameId: string) => `coach:job-ref:${wallet}:${gameId}`,
  analysis: (wallet: string, gameId: string) => `coach:analysis:${wallet}:${gameId}`,
  analysisList: (wallet: string) => `coach:analyses:${wallet}`,
  credits: (wallet: string) => `coach:credits:${wallet}`,
  pendingJob: (wallet: string) => `coach:pending:${wallet}`,
} as const;
