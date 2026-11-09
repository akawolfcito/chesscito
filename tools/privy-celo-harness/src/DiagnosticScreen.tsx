import { canSend, canSign, truncateHex } from "./harness-logic";
import type { DiagnosticCallbacks, DiagnosticViewModel } from "./view-model";

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

export function DiagnosticScreen({
  vm,
  cb,
}: {
  vm: DiagnosticViewModel;
  cb: DiagnosticCallbacks;
}) {
  if (vm.phase === "config-error") {
    return (
      <main className="harness">
        <h1>Privy × Celo — Phase 0 Harness</h1>
        <section className="card error" data-testid="config-error">
          <h2>Configuration error</h2>
          <p>{vm.configError}</p>
        </section>
      </main>
    );
  }

  const signEnabled = canSign(vm.phase) && !vm.busy.signing;
  const sendEnabled = canSend(vm.phase) && !vm.busy.sending;
  const chainMatches =
    vm.connectedChainId != null && vm.connectedChainId === vm.expectedChainId;

  return (
    <main className="harness">
      <h1>Privy × Celo — Phase 0 Harness</h1>

      <section className="card">
        <h2>Authentication</h2>
        <Row label="App ID (masked)" value={vm.maskedAppId ?? "—"} testId="masked-app-id" />
        <Row label="ready" value={String(vm.ready)} testId="ready" />
        <Row label="authenticated" value={String(vm.authenticated)} testId="authenticated" />
        <Row label="login method" value={vm.loginMethod ?? "—"} testId="login-method" />
        <div className="actions">
          <button type="button" onClick={cb.onLogin} disabled={!vm.ready || vm.authenticated}>
            Login
          </button>
          <button type="button" onClick={cb.onLogout} disabled={!vm.authenticated}>
            Logout
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Embedded wallet</h2>
        <Row label="address" value={vm.address ?? "—"} testId="wallet-address" />
        <Row label="wallet type" value={vm.walletType ?? "—"} testId="wallet-type" />
        <Row label="creation status" value={vm.walletCreationStatus} testId="wallet-status" />
        <div className="actions">
          <button
            type="button"
            onClick={cb.onCopyAddress}
            disabled={!vm.address}
            data-testid="copy-address"
          >
            Copy address
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Sign message</h2>
        <Row
          label="signature"
          value={truncateHex(vm.signature)}
          testId="signature"
        />
        {vm.signError ? (
          <Row label="error" value={vm.signError} testId="sign-error" />
        ) : null}
        <div className="actions">
          <button
            type="button"
            onClick={cb.onSign}
            disabled={!signEnabled}
            data-testid="sign-button"
          >
            {vm.busy.signing ? "Signing…" : "Sign test message"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Celo testnet</h2>
        <Row label="expected chain ID" value={String(vm.expectedChainId)} testId="expected-chain" />
        <Row
          label="connected chain ID"
          value={vm.connectedChainId != null ? String(vm.connectedChainId) : "—"}
          testId="connected-chain"
        />
        <Row label="chain matches" value={String(chainMatches)} testId="chain-matches" />
        <Row label="balance" value={vm.balance ?? "—"} testId="balance" />
        <Row label="RPC status" value={vm.rpcStatus} testId="rpc-status" />
        <div className="actions">
          <button
            type="button"
            onClick={cb.onEnsureTestnet}
            disabled={!vm.authenticated || vm.busy.switching}
            data-testid="switch-chain"
          >
            {vm.busy.switching ? "Switching…" : "Ensure Celo testnet"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Innocuous transaction (testnet only)</h2>
        <p className="hint">Self-transfer of 0 CELO on testnet. Never mainnet, never treasury.</p>
        <Row label="tx hash" value={truncateHex(vm.txHash, 12, 10)} testId="tx-hash" />
        <Row label="from" value={vm.txFrom ?? "—"} testId="tx-from" />
        <Row label="to" value={vm.txTo ?? "—"} testId="tx-to" />
        <Row label="value" value={vm.txValue ?? "—"} testId="tx-value" />
        <Row label="status" value={vm.txStatus ?? "—"} testId="tx-status" />
        <Row label="receipt" value={vm.receiptStatus ?? "—"} testId="tx-receipt" />
        {vm.txError ? <Row label="error" value={vm.txError} testId="tx-error" /> : null}
        <div className="actions">
          <button
            type="button"
            onClick={cb.onSend}
            disabled={!sendEnabled || !chainMatches}
            data-testid="send-button"
          >
            {vm.busy.sending ? "Sending…" : "Send 0 CELO to self (testnet)"}
          </button>
        </div>
      </section>
    </main>
  );
}
