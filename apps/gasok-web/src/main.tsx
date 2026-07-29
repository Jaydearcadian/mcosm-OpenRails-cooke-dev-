import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GIWA } from './data/giwa';
import { CinematicHero } from './components/CinematicHero';
import { LifecycleStory } from './components/LifecycleStory';
import { SystemMap } from './components/SystemMap';
import { RuntimeArchitecture } from './components/RuntimeArchitecture';
import { Footer } from './components/Footer';
import { LiveVerticalSlice } from './components/LiveVerticalSlice';
import { WalletProvider, useWallet } from './lib/wallet';
import { claimOrUsd, formatNative, formatOrUsd, readLiveAccount, type LiveAccount } from './lib/openrails';
import './styles.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0, behavior: 'auto' }), [pathname]);
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [compact, setCompact] = useState(false);
  const { address, connecting, connect } = useWallet();

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 90);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="app-shell">
      <ScrollToTop />
      <header className={`control-strip ${compact ? 'is-compact' : ''}`}>
        <Link className="brand" to="/" aria-label="OpenRails home"><span className="brand-mark">OR</span><span>OPENRAILS</span></Link>
        <nav aria-label="Primary navigation"><NavLink to="/system">SYSTEM</NavLink><NavLink to="/network">NETWORK</NavLink><NavLink to="/build">BUILD</NavLink></nav>
        <div className="network-control"><span><i /> GIWA / SEPOLIA</span><button type="button" onClick={() => void connect()}>{connecting ? 'CONNECTING' : address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'CONNECT'}</button></div>
      </header>
      {children}
      <Footer />
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  return <main><CinematicHero onViewNetwork={() => navigate('/network')} /><LifecycleStory /><SystemMap /></main>;
}

function LiveNetworkAccount() {
  const { address, connect, publicClient, walletClient } = useWallet();
  const [account, setAccount] = useState<LiveAccount>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!address) return;
    setError('');
    try { setAccount(await readLiveAccount(publicClient, address)); }
    catch (value) { setError(value instanceof Error ? value.message : String(value)); }
  };
  useEffect(() => { void refresh(); }, [address]);

  const claim = async () => {
    if (!address) return;
    setBusy(true); setError('');
    try {
      await claimOrUsd(await walletClient(), publicClient, address);
      await refresh();
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
    finally { setBusy(false); }
  };

  return <section className="network-live-account">
    <div><span className="tech-label">LIVE ACCOUNT / SAME WALLET BOUNDARY</span><h2>{address ? `${address.slice(0, 8)}…${address.slice(-6)}` : 'Connect a wallet to inspect live state.'}</h2><p>Balances, faucet eligibility and block height are read directly from GIWA Sepolia. Claims are signed and broadcast by your wallet.</p></div>
    <div className="network-live-grid">
      <article><span>orUSD BALANCE</span><strong>{account ? formatOrUsd(account.orUsdBalance) : '—'}</strong></article>
      <article><span>GIWA GAS</span><strong>{account ? formatNative(account.nativeBalance) : '—'}</strong></article>
      <article><span>FAUCET</span><strong>{account ? account.canClaim ? 'AVAILABLE' : 'COOLDOWN' : '—'}</strong></article>
      <article><span>LIVE BLOCK</span><strong>{account?.blockNumber.toString() ?? '—'}</strong></article>
    </div>
    <div className="network-live-actions">
      {!address ? <button onClick={() => void connect()}>Connect wallet</button> : <><button onClick={() => void refresh()}>Refresh reads</button><button className="primary" disabled={busy || !account?.canClaim} onClick={() => void claim()}>{busy ? 'Claiming…' : 'Claim 1,000 orUSD'}</button></>}
      {error && <span>{error}</span>}
    </div>
  </section>;
}

function Network() {
  return (
    <main className="editorial-page network-page">
      <section className="page-hero"><span className="tech-label">NETWORK / LIVE ON GIWA</span><h1>GIWA deployment,<br /><span>made inspectable.</span></h1><p>Canonical contracts, faucet state, chain configuration, and transaction evidence for the OpenRails GIWA Sepolia deployment.</p></section>
      <section className="network-stats"><div><span>CHAIN ID</span><strong>{GIWA.chainId}</strong></div><div><span>NETWORK</span><strong>GIWA SEPOLIA</strong></div><div><span>FAUCET CLAIM</span><strong>{GIWA.faucet.claimAmount}</strong></div><div><span>COOLDOWN</span><strong>{GIWA.faucet.cooldown}</strong></div></section>
      <LiveNetworkAccount />
      <section className="network-operation">
        <div className="network-operation-copy"><span className="tech-label">LIVE ACCOUNT SURFACE</span><h2>Connect once. Inspect the canonical layer directly.</h2><p>The webapp keeps demonstration commercial state separate from live GIWA balances, contract reads, and transaction evidence.</p></div>
        <div className="network-operation-panel"><div><span>RPC STATUS</span><strong><i /> OPERATIONAL</strong></div><div><span>SETTLEMENT ASSET</span><strong>orUSD / 6 DECIMALS</strong></div><div><span>FAUCET RESERVE</span><strong>100,000 orUSD / DEPLOYED</strong></div><a href={`${GIWA.explorerUrl}/address/${GIWA.contracts.faucet}`} target="_blank" rel="noreferrer">Inspect faucet on GIWA ↗</a></div>
      </section>
      <section className="ledger-section"><div className="section-index"><span>01</span><strong>DEPLOYED CONTRACTS</strong></div><div className="ledger">{Object.entries(GIWA.contracts).map(([name, address], index) => <motion.a href={`${GIWA.explorerUrl}/address/${address}`} target="_blank" rel="noreferrer" className="ledger-row" key={name} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }} viewport={{ once: true }}><span className="ledger-index">0{index + 1}</span><strong>{name}</strong><code>{address}</code><span className="live-label"><i /> LIVE ON GIWA</span><b>↗</b></motion.a>)}</div></section>
      <section className="network-closing"><span>02 / CANONICAL EVIDENCE</span><h2>Commercial state explains why value should move.<br />GIWA proves that it did.</h2><Link to="/system">Inspect the complete lifecycle →</Link></section>
    </main>
  );
}

function Build() {
  return (
    <main className="editorial-page build-page">
      <section className="page-hero"><span className="tech-label">BUILD / OPENRAILS RUNTIME</span><h1>Infrastructure for accountable<br /><span>programmable commerce.</span></h1><p>The BNH Runtime coordinates policy evaluation, action state, verification, GIWA observation, and bounded rectification without owning a signing key.</p></section>
      <RuntimeArchitecture />
      <section className="build-evidence"><div><span>SDK</span><strong>Prepare bounded RailsFlow drafts</strong><small>Typed inputs, projected economics, metadata binding, and wallet-ready output.</small></div><div><span>MCP</span><strong>Read and prepare without signing</strong><small>Safe agent tools that expose state and build actions while keeping keys outside the runtime.</small></div><div><span>TELEGRAM</span><strong>Conversational operational sidecar</strong><small>Requests and status in chat; authority, evidence, and canonical state remain in OpenRails.</small></div></section>
      <section className="interface-ledger"><div className="section-index"><span>02</span><strong>INTERFACE CONTRACTS</strong></div><div className="interface-grid"><article><span>PROPOSAL</span><code>{`{ workspaceId, pathId, action, value, counterparty }`}</code><p>A requested commercial action. It is not authority and it is not a transaction.</p></article><article><span>DECISION</span><code>{`{ result: "ALLOW", pathHash, proposalHash, reasonCodes }`}</code><p>Baphomet binds an outcome to the exact policy and economic state evaluated.</p></article><article><span>OBSERVATION</span><code>{`{ chainId: 91342, txHash, blockNumber, status }`}</code><p>GIWA observation advances canonical financial state only after receipt verification.</p></article></div></section>
      <section className="build-closing"><span>03 / AUTHORIZATION BOUNDARY</span><h2>The Runtime coordinates.<br />The wallet authorises.<br />GIWA finalises.</h2><Link to="/network">Inspect live deployment →</Link></section>
    </main>
  );
}

function App() {
  return <Shell><Routes><Route path="/" element={<Home />} /><Route path="/system" element={<main><LiveVerticalSlice /><SystemMap direct /></main>} /><Route path="/network" element={<Network />} /><Route path="/build" element={<Build />} /></Routes></Shell>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><WalletProvider><BrowserRouter><App /></BrowserRouter></WalletProvider></React.StrictMode>);
