import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { GIWA } from '../data/giwa';
import {
  claimOrUsd,
  formatNative,
  formatOrUsd,
  readLiveAccount,
  type LiveAccount,
} from '../lib/openrails';
import { useWallet } from '../lib/wallet';

function LiveNetworkAccount() {
  const {
    address,
    connect,
    publicClient,
    walletClient,
  } = useWallet();

  const [account, setAccount] = useState<LiveAccount>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!address) return;

    setError('');

    try {
      setAccount(await readLiveAccount(publicClient, address));
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : String(value),
      );
    }
  };

  useEffect(() => {
    void refresh();
  }, [address]);

  const claim = async () => {
    if (!address) return;

    setBusy(true);
    setError('');

    try {
      await claimOrUsd(
        await walletClient(),
        publicClient,
        address,
      );

      await refresh();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : String(value),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="network-live-account">
      <div>
        <span className="tech-label">
          LIVE ACCOUNT / SAME WALLET BOUNDARY
        </span>

        <h2>
          {address
            ? `${address.slice(0, 8)}…${address.slice(-6)}`
            : 'Connect a wallet to inspect live state.'}
        </h2>

        <p>
          Balances, faucet eligibility and block height are read
          directly from GIWA Sepolia. Claims are signed and broadcast
          by your wallet.
        </p>
      </div>

      <div className="network-live-grid">
        <article>
          <span>orUSD BALANCE</span>
          <strong>
            {account
              ? formatOrUsd(account.orUsdBalance)
              : '—'}
          </strong>
        </article>

        <article>
          <span>GIWA GAS</span>
          <strong>
            {account
              ? formatNative(account.nativeBalance)
              : '—'}
          </strong>
        </article>

        <article>
          <span>FAUCET</span>
          <strong>
            {account
              ? account.canClaim
                ? 'AVAILABLE'
                : 'COOLDOWN'
              : '—'}
          </strong>
        </article>

        <article>
          <span>LIVE BLOCK</span>
          <strong>
            {account?.blockNumber.toString() ?? '—'}
          </strong>
        </article>
      </div>

      <div className="network-live-actions">
        {!address ? (
          <button onClick={() => void connect()}>
            Connect wallet
          </button>
        ) : (
          <>
            <button onClick={() => void refresh()}>
              Refresh reads
            </button>

            <button
              className="primary"
              disabled={busy || !account?.canClaim}
              onClick={() => void claim()}
            >
              {busy
                ? 'Claiming…'
                : 'Claim 1,000 orUSD'}
            </button>
          </>
        )}

        {error && <span>{error}</span>}
      </div>
    </section>
  );
}

export default function NetworkRoute() {
  return (
    <main className="editorial-page network-page">
      <section className="page-hero">
        <span className="tech-label">
          NETWORK / LIVE ON GIWA
        </span>

        <h1>
          GIWA deployment,
          <br />
          <span>made inspectable.</span>
        </h1>

        <p>
          Canonical contracts, faucet state, chain configuration, and
          transaction evidence for the OpenRails GIWA Sepolia
          deployment.
        </p>
      </section>

      <section className="network-stats">
        <div>
          <span>CHAIN ID</span>
          <strong>{GIWA.chainId}</strong>
        </div>

        <div>
          <span>NETWORK</span>
          <strong>GIWA SEPOLIA</strong>
        </div>

        <div>
          <span>FAUCET CLAIM</span>
          <strong>{GIWA.faucet.claimAmount}</strong>
        </div>

        <div>
          <span>COOLDOWN</span>
          <strong>{GIWA.faucet.cooldown}</strong>
        </div>
      </section>

      <LiveNetworkAccount />

      <section className="network-operation">
        <div className="network-operation-copy">
          <span className="tech-label">
            LIVE ACCOUNT SURFACE
          </span>

          <h2>
            Connect once. Inspect the canonical layer directly.
          </h2>

          <p>
            The webapp keeps demonstration commercial state separate
            from live GIWA balances, contract reads, and transaction
            evidence.
          </p>
        </div>

        <div className="network-operation-panel">
          <div>
            <span>RPC STATUS</span>
            <strong>
              <i /> OPERATIONAL
            </strong>
          </div>

          <div>
            <span>SETTLEMENT ASSET</span>
            <strong>orUSD / 6 DECIMALS</strong>
          </div>

          <div>
            <span>FAUCET RESERVE</span>
            <strong>100,000 orUSD / DEPLOYED</strong>
          </div>

          <a
            href={`${GIWA.explorerUrl}/address/${GIWA.contracts.faucet}`}
            target="_blank"
            rel="noreferrer"
          >
            Inspect faucet on GIWA ↗
          </a>
        </div>
      </section>

      <section className="ledger-section">
        <div className="section-index">
          <span>01</span>
          <strong>DEPLOYED CONTRACTS</strong>
        </div>

        <div className="ledger">
          {Object.entries(GIWA.contracts).map(
            ([name, address], index) => (
              <motion.a
                href={`${GIWA.explorerUrl}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="ledger-row"
                key={name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
              >
                <span className="ledger-index">
                  0{index + 1}
                </span>

                <strong>{name}</strong>
                <code>{address}</code>

                <span className="live-label">
                  <i /> LIVE ON GIWA
                </span>

                <b>↗</b>
              </motion.a>
            ),
          )}
        </div>
      </section>

      <section className="network-closing">
        <span>02 / CANONICAL EVIDENCE</span>

        <h2>
          Commercial state explains why value should move.
          <br />
          GIWA proves that it did.
        </h2>

        <Link to="/system">
          Inspect the complete lifecycle →
        </Link>
      </section>
    </main>
  );
}
