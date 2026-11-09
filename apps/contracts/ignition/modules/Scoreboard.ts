import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ScoreboardModule = buildModule("ScoreboardModule", (m) => {
  const submitCooldown = m.getParameter("submitCooldown", 60);
  const maxSubmissionsPerDay = m.getParameter("maxSubmissionsPerDay", 20);
  const initialOwner = m.getAccount(0);

  const scoreboard = m.contract("Scoreboard", [
    submitCooldown,
    maxSubmissionsPerDay,
    initialOwner,
  ]);

  return { scoreboard };
});

export default ScoreboardModule;
