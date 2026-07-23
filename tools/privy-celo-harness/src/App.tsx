import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useSendTransaction,
  useSignMessage,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";

import { SEND_CHAIN_ID } from "./chains";
import { DiagnosticScreen } from "./DiagnosticScreen";
import {
  assertTestnetForSend,
  maskAppId,
  resolveWalletPhase,
  TEST_MESSAGE,
} from "./harness-logic";
import type { DiagnosticViewModel } from "./view-model";

/**
 * Container: wires Privy + wagmi hooks into a plain view model and hands it to
 * the presentational DiagnosticScreen. All send paths go through
 * assertTestnetForSend so mainnet can never be broadcast on.
 */
export function App({ appId }: { appId: string }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { address, connector } = useAccount();
  const connectedChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();

  const balanceQuery = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: SEND_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const [signature, setSignature] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [busy, setBusy] = useState({ signing: false, switching: false, sending: false });

  const receiptQuery = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    chainId: SEND_CHAIN_ID,
    query: { enabled: Boolean(txHash) },
  });

  const embeddedWallet = useMemo(
    () => wallets.find((w) => w.walletClientType === "privy") ?? null,
    [wallets],
  );

  const loginMethod = user?.google
    ? "google"
    : user?.email
      ? "email"
      : authenticated
        ? "other"
        : null;

  const phase = resolveWalletPhase({
    hasAppId: true,
    ready,
    authenticated,
    address: address ?? null,
  });

  const onSign = useCallback(async () => {
    setSignError(null);
    setSignature(null);
    setBusy((b) => ({ ...b, signing: true }));
    try {
      const sig = await signMessageAsync({ message: TEST_MESSAGE });
      setSignature(sig);
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "sign_failed");
    } finally {
      setBusy((b) => ({ ...b, signing: false }));
    }
  }, [signMessageAsync]);

  const onEnsureTestnet = useCallback(async () => {
    setBusy((b) => ({ ...b, switching: true }));
    try {
      await switchChainAsync({ chainId: SEND_CHAIN_ID });
    } catch {
      /* surfaced via connectedChainId mismatch in the UI */
    } finally {
      setBusy((b) => ({ ...b, switching: false }));
    }
  }, [switchChainAsync]);

  const onSend = useCallback(async () => {
    setTxError(null);
    setTxHash(null);
    // Hard guard BEFORE any broadcast. Throws on mainnet / non-testnet.
    try {
      assertTestnetForSend(connectedChainId);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "chain_guard_failed");
      return;
    }
    if (!address) {
      setTxError("no_address");
      return;
    }
    setBusy((b) => ({ ...b, sending: true }));
    try {
      // Innocuous self-transfer of 0 value on testnet.
      const hash = await sendTransactionAsync({
        to: address as `0x${string}`,
        value: 0n,
        chainId: SEND_CHAIN_ID,
      });
      setTxHash(hash);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "tx_failed");
    } finally {
      setBusy((b) => ({ ...b, sending: false }));
    }
  }, [address, connectedChainId, sendTransactionAsync]);

  const onCopyAddress = useCallback(() => {
    if (address) void navigator.clipboard?.writeText(address);
  }, [address]);

  const rpcStatus = balanceQuery.isLoading
    ? "loading"
    : balanceQuery.isError
      ? "error"
      : balanceQuery.data
        ? "ok"
        : "idle";

  const txStatus = busy.sending
    ? "sending"
    : txHash
      ? "broadcast"
      : txError
        ? "error"
        : null;

  const vm: DiagnosticViewModel = {
    phase,
    configError: null,
    maskedAppId: maskAppId(appId),
    ready,
    authenticated,
    loginMethod,
    address: address ?? null,
    walletType: embeddedWallet
      ? `embedded (${embeddedWallet.walletClientType})`
      : connector?.name ?? null,
    walletCreationStatus: embeddedWallet
      ? "created"
      : authenticated
        ? "creating…"
        : "—",
    expectedChainId: SEND_CHAIN_ID,
    connectedChainId: authenticated ? connectedChainId : null,
    balance: balanceQuery.data
      ? `${balanceQuery.data.formatted} ${balanceQuery.data.symbol}`
      : null,
    rpcStatus,
    signature,
    signError,
    txHash,
    txFrom: txHash ? address ?? null : null,
    txTo: txHash ? address ?? null : null,
    txValue: txHash ? "0 CELO" : null,
    txStatus,
    txError,
    receiptStatus: receiptQuery.data
      ? receiptQuery.data.status
      : txHash
        ? "waiting…"
        : null,
    busy,
  };

  return (
    <DiagnosticScreen
      vm={vm}
      cb={{
        onLogin: login,
        onLogout: logout,
        onSign,
        onEnsureTestnet,
        onSend,
        onCopyAddress,
      }}
    />
  );
}
