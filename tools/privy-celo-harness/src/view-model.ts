import type { WalletPhase } from "./harness-logic";

/** Fully-serializable snapshot the presentational screen renders. Keeping the
 *  screen driven by a plain object (no SDK hooks) is what makes it testable
 *  without mocking Privy or wagmi. */
export type DiagnosticViewModel = {
  phase: WalletPhase;
  configError: string | null;
  maskedAppId: string | null;

  // Authentication
  ready: boolean;
  authenticated: boolean;
  loginMethod: string | null;

  // Embedded wallet
  address: string | null;
  walletType: string | null;
  walletCreationStatus: string;

  // Celo testnet
  expectedChainId: number;
  connectedChainId: number | null;
  balance: string | null;
  rpcStatus: string;

  // Sign message
  signature: string | null;
  signError: string | null;

  // Transaction
  txHash: string | null;
  txFrom: string | null;
  txTo: string | null;
  txValue: string | null;
  txStatus: string | null;
  txError: string | null;
  receiptStatus: string | null;

  busy: { signing: boolean; switching: boolean; sending: boolean };
};

export type DiagnosticCallbacks = {
  onLogin: () => void;
  onLogout: () => void;
  onSign: () => void;
  onEnsureTestnet: () => void;
  onSend: () => void;
  onCopyAddress: () => void;
};
