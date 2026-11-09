// MUST stay first: installs globalThis.Buffer before Privy/wagmi are evaluated.
import "./polyfills";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { DiagnosticScreen } from "./DiagnosticScreen";
import { resolveAppId } from "./harness-logic";
import { Providers } from "./providers";
import { SEND_CHAIN_ID } from "./chains";
import type { DiagnosticViewModel } from "./view-model";
import "./styles.css";

const config = resolveAppId(import.meta.env.VITE_PRIVY_APP_ID);

function Root() {
  if (!config.ok) {
    // No App ID → render the config-error screen WITHOUT mounting Privy (which
    // requires a valid appId). This is the "sin App ID → error claro" path.
    const vm: DiagnosticViewModel = {
      phase: "config-error",
      configError: config.error,
      maskedAppId: null,
      ready: false,
      authenticated: false,
      loginMethod: null,
      address: null,
      walletType: null,
      walletCreationStatus: "—",
      expectedChainId: SEND_CHAIN_ID,
      connectedChainId: null,
      balance: null,
      rpcStatus: "idle",
      signature: null,
      signError: null,
      txHash: null,
      txFrom: null,
      txTo: null,
      txValue: null,
      txStatus: null,
      txError: null,
      receiptStatus: null,
      busy: { signing: false, switching: false, sending: false },
    };
    return (
      <DiagnosticScreen
        vm={vm}
        cb={{
          onLogin: () => {},
          onLogout: () => {},
          onSign: () => {},
          onEnsureTestnet: () => {},
          onSend: () => {},
          onCopyAddress: () => {},
        }}
      />
    );
  }

  return (
    <Providers appId={config.appId}>
      <App appId={config.appId} />
    </Providers>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
