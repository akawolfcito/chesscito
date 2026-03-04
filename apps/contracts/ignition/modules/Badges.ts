import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BadgesModule = buildModule("BadgesModule", (m) => {
  const baseURI = m.getParameter("baseURI", "ipfs://chesscito/badges/");
  const initialOwner = m.getAccount(0);

  const badges = m.contract("Badges", [baseURI, initialOwner]);

  return { badges };
});

export default BadgesModule;
