import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ACTIVE_NETWORK } from '../data/network';

const railControls = [
  ['ALLOCATION', '420 orUSD'],
  ['VELOCITY', '14 orUSD / SEC'],
  ['LIFESPAN', '30 SECONDS'],
  ['NONCE LANE', '04'],
  ['RESIDUAL', 'RETURN TO PAYER']
];

const lifecycle = [
  ['OWN', 'Workspace establishes economic ownership.'],
  ['AUTHORISE', 'Path defines the limits around an actor or agent.'],
  ['COMMIT', 'Pact freezes the accepted commercial terms.'],
  ['PROVE', 'Evidence advances settlement eligibility.'],
  ['SETTLE', 'The rail moves value and preserves canonical receipts.'],
  ['RESOLVE', 'Gaia handles bounded exception paths.']
];

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .16 }} transition={{ duration: .72, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

function DrawLine({ className = '' }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.i className={className} initial={reduceMotion ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: .4 }} transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }} />;
}

export function NarrativeHome() {
  const pageRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: pageRef, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: .35 });
  const heroCopyY = useTransform(scrollYProgress, [0, .09], [0, reduceMotion ? 0 : -70]);
  const heroVisualY = useTransform(scrollYProgress, [0, .12], [0, reduceMotion ? 0 : 85]);
  const heroOpacity = useTransform(scrollYProgress, [0, .11], [1, .38]);
  const ambientY = useTransform(scrollYProgress, [0, .14], [0, reduceMotion ? 0 : 44]);

  return (
    <main ref={pageRef} className="narrative-home">
      <div className="narrative-progress" aria-hidden="true"><motion.i style={{ scaleX: progress }} /></div>
      <section className="narrative-hero" aria-labelledby="narrative-title">
        <motion.div className="narrative-ambient-grid" aria-hidden="true" style={{ y: ambientY }} />
        <motion.div className="narrative-scan" aria-hidden="true" animate={reduceMotion ? undefined : { left: ['-8%', '108%'] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="narrative-hero-copy" style={{ y: heroCopyY, opacity: heroOpacity }}>
          <motion.span className="tech-label" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>PROGRAMMABLE SETTLEMENT FOR MACHINE COMMERCE</motion.span>
          <motion.h1 id="narrative-title" initial={reduceMotion ? false : { opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, delay: .08, ease: [0.22, 1, 0.36, 1] }}>Software operates continuously.<br /><span>Value should be able to move with it.</span></motion.h1>
          <motion.p initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .22 }}>OpenRails creates bounded payment rails for people, applications, and agents. It controls how much value may move, how quickly it may move, how long authority lasts, and where unspent value returns.</motion.p>
          <motion.div className="narrative-actions" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .6, delay: .36 }}>
            <a className="primary" href="#open-the-rail">See how the rail works <b>↓</b></a>
            <Link to="/system">Enter the System Lab</Link>
          </motion.div>
          <motion.div className="narrative-evidence" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .6, delay: .48 }}><i /> LIVE DEPLOYMENT · {ACTIVE_NETWORK.displayLabel} · CHAIN {ACTIVE_NETWORK.chainId}</motion.div>
        </motion.div>
        <motion.div className="rail-hero-visual" aria-label="A bounded 420 orUSD OpenRails allocation" style={{ y: heroVisualY }} initial={reduceMotion ? false : { opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: .16, ease: [0.22, 1, 0.36, 1] }}>
          <div className="rail-hero-head"><span>RAIL / 018</span><strong>PROGRAMMABLE ALLOCATION</strong></div>
          <div className="rail-pool">
            <motion.i className="rail-pool-ring ring-a" animate={reduceMotion ? undefined : { rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} />
            <motion.i className="rail-pool-ring ring-b" animate={reduceMotion ? undefined : { rotate: -360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }} />
            <span>AVAILABLE</span><strong>420</strong><small>orUSD</small>
          </div>
          <div className="rail-track">
            <span className="rail-origin">PAYER</span>
            <i className="rail-line" />
            <motion.b className="rail-signal" animate={reduceMotion ? { left: '45%' } : { left: ['6%', '84%', '6%'] }} transition={{ duration: 8, ease: 'linear', repeat: Infinity }} />
            <motion.em className="rail-trace" animate={reduceMotion ? undefined : { scaleX: [0, 1, 0], opacity: [.1, .8, .1] }} transition={{ duration: 8, ease: 'linear', repeat: Infinity }} />
            <span className="rail-destination">RECIPIENT</span>
          </div>
          <div className="rail-controls">{railControls.map(([label, value], index) => <motion.div key={label} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .42 + index * .07 }}><span>{label}</span><strong>{value}</strong></motion.div>)}</div>
          <div className="rail-hero-foot"><span>BOUNDED</span><span>NON-CUSTODIAL</span><span>WALLET AUTHORISED</span></div>
        </motion.div>
      </section>

      <section className="narrative-problem">
        <Reveal>
          <span className="chapter-number">01 / THE GAP</span>
          <h2>A transaction proves that value moved.<br /><span>It rarely proves why it was allowed to move.</span></h2>
        </Reveal>
        <motion.div className="ordinary-transfer" initial={reduceMotion ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: .4 }} transition={{ duration: .7 }}>
          <motion.div initial={reduceMotion ? false : { x: -30 }} whileInView={{ x: 0 }} viewport={{ once: true }}><span>WALLET</span><strong>BROAD APPROVAL</strong></motion.div><i><motion.b animate={reduceMotion ? undefined : { x: [-24, 24, -24] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>420 orUSD</motion.b></i><motion.div initial={reduceMotion ? false : { x: 30 }} whileInView={{ x: 0 }} viewport={{ once: true }}><span>RECIPIENT</span><strong>VALUE RECEIVED</strong></motion.div>
        </motion.div>
        <div className="problem-ledger">
          {['NO EXECUTION VELOCITY', 'NO ISOLATED ACTIVITY LANE', 'NO DETERMINISTIC EXPIRY', 'NO RESIDUAL VALUE POLICY', 'LITTLE COMMERCIAL CONTEXT'].map((item, index) => <Reveal key={item} delay={index * .05}><span>0{index + 1}</span><strong>{item}</strong></Reveal>)}
        </div>
        <Reveal><p className="narrative-pullquote">Machine commerce needs something between <em>no authority</em> and <em>unlimited authority</em>.</p></Reveal>
      </section>

      <section id="open-the-rail" className="narrative-rail-section">
        <div className="section-heading-grid">
          <Reveal><span className="chapter-number">02 / OPEN THE RAIL</span><h2>OpenRails turns payment authority into a bounded rail.</h2></Reveal>
          <Reveal delay={.08}><p>The original OpenRails primitives remain the economic engine: allocation, velocity, lifespan, nonce isolation, and deterministic residual routing.</p></Reveal>
        </div>
        <div className="rail-primitives">
          {[
            ['01', 'ALLOCATE', 'Commit a bounded pool instead of exposing a wallet balance.', '/docs/railscard'],
            ['02', 'CONTROL VELOCITY', 'Limit the pace at which value can become earned or drawable.', '/docs/nonce-lanes'],
            ['03', 'ISOLATE EXECUTION', 'Place the activity inside a dedicated two dimensional nonce lane.', '/docs/nonce-lanes'],
            ['04', 'SET EXPIRY', 'End authority deterministically instead of relying on manual revocation.', '/docs/railsflow'],
            ['05', 'PROTECT RESIDUAL', 'Route earned value forward and unused value back safely.', '/docs/stn-delta']
          ].map(([index, title, copy, href], itemIndex) => <Reveal key={title} className="rail-primitive" delay={itemIndex * .05}><span>{index}</span><h3>{title}</h3><p>{copy}</p><Link to={href}>READ PRIMITIVE →</Link><motion.i initial={reduceMotion ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: .75, delay: itemIndex * .05 }} /></Reveal>)}
        </div>
        <motion.div className="delta-rail" initial={reduceMotion ? false : { opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .8 }}>
          <div className="delta-head"><span>STN-DELTA / VALUE ROUTING</span><strong>420 orUSD ALLOCATION</strong></div>
          <div className="delta-flow"><div><span>EARNED</span><strong>210</strong><small>→ RECIPIENT</small></div><DrawLine /><div><span>RESIDUAL</span><strong>210</strong><small>→ PAYER</small></div></div>
        </motion.div>
      </section>

      <section className="narrative-bridge">
        <Reveal className="bridge-copy">
          <span className="chapter-number">03 / THE REASON</span>
          <h2>A programmable rail can determine how value moves.<br /><span>It still needs to know why movement is allowed.</span></h2>
        </Reveal>
        <div className="bridge-questions">
          {['Who owns this activity?', 'Which agent is acting?', 'What exactly may it do?', 'Which commitment was accepted?', 'What evidence makes value eligible?', 'What happens when execution fails?'].map((question, index) => <Reveal key={question} delay={index * .045}><span>0{index + 1}</span><strong>{question}</strong></Reveal>)}
        </div>
        <Reveal><p className="bridge-answer">The OpenRails Runtime places explicit authority, agreement, evidence, and accountability around the settlement rail.</p></Reveal>
      </section>

      <section className="proposal-story">
        <div className="section-heading-grid">
          <Reveal><span className="chapter-number">04 / ONE ECONOMIC ACTION</span><h2>Follow one proposal through OpenRails.</h2></Reveal>
          <Reveal delay={.08}><p>The same 420 orUSD action becomes progressively more structured, from intent to canonical settlement.</p></Reveal>
        </div>
        <Reveal className="proposal-object">
          <div className="proposal-object-head"><span>PROPOSAL / 018</span><strong>PREPARE RAILSFLOW</strong></div>
          <div className="proposal-properties"><div><span>AGENT</span><strong>COMMERCE OPERATOR</strong></div><div><span>ALLOCATION</span><strong>420 orUSD</strong></div><div><span>DURATION</span><strong>30 SECONDS</strong></div><div><span>COUNTERPARTY</span><strong>VERIFIED RECIPIENT</strong></div></div>
        </Reveal>
        <div className="proposal-chain">
          {lifecycle.map(([title, copy], index) => <motion.div key={title} className="proposal-chain-step" initial={reduceMotion ? false : { opacity: .2, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .45 }} transition={{ duration: .55, delay: index * .1 }}><span>0{index + 1}</span><strong>{title}</strong><p>{copy}</p>{index < lifecycle.length - 1 && <motion.i initial={reduceMotion ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: .65, delay: .22 + index * .1 }} />}</motion.div>)}
        </div>
      </section>

      <section className="decision-section">
        <div className="section-heading-grid"><Reveal><span className="chapter-number">05 / DECISION BOUNDARY</span><h2>Execution begins only after authority survives evaluation.</h2></Reveal><Reveal delay={.08}><p>Baphomet evaluates the exact proposal against the active Workspace, assigned Path, and current economic state.</p></Reveal></div>
        <div className="decision-split">
          <motion.article className="decision-card allow" initial={reduceMotion ? false : { opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .75 }}><div className="decision-card-head"><span>PROPOSAL / 018</span><strong>ALLOW</strong></div><h3>420 <small>orUSD</small></h3><p>Within the active Path ceiling.</p><div className="decision-checks">{['AGENT ACTIVE', 'PATH ACTIVE', 'ACTION PERMITTED', 'ASSET PERMITTED', 'VALUE ≤ 1,000'].map((item, index) => <motion.span key={item} initial={reduceMotion ? false : { opacity: .2 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: .25 + index * .08 }}>{item}<b>PASS</b></motion.span>)}</div><footer>Pact may form · wallet confirmation may follow</footer></motion.article>
          <motion.article className="decision-card block" initial={reduceMotion ? false : { opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .75 }}><div className="decision-card-head"><span>PROPOSAL / 019</span><strong>BLOCK</strong></div><h3>1,420 <small>orUSD</small></h3><p>Above the active Path ceiling.</p><div className="decision-stop"><motion.i animate={reduceMotion ? undefined : { scaleX: [.2, 1, .2] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} /><strong>NO PACT</strong><strong>NO WALLET REQUEST</strong><strong>NO VALUE MOVED</strong></div><footer>Stopped before the settlement rail</footer></motion.article>
        </div>
      </section>

      <section className="commit-proof-section">
        <motion.div className="commit-panel" initial={reduceMotion ? false : { opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .16 }} transition={{ duration: .8 }}>
          <span className="chapter-number">06 / AGREEMENT</span><h2>Permission becomes a commercial commitment.</h2><p>The accepted proposal is frozen into a Pact before any payment object opens.</p>
          <div className="pact-docket"><div><span>PACT</span><strong>2048</strong></div><div><span>PROPOSAL</span><strong>018</strong></div><div><span>ALLOCATION</span><strong>420 orUSD</strong></div><div><span>EVIDENCE</span><strong>GIWA RECEIPT</strong></div><div><span>DISPUTE</span><strong>GAIA BOUNDED</strong></div></div>
          <div className="hash-binding"><span>PATH HASH</span><DrawLine /><span>PROPOSAL HASH</span><DrawLine /><span>DECISION HASH</span><DrawLine /><span>PACT TERMS HASH</span></div>
        </motion.div>
        <motion.div className="proof-panel" initial={reduceMotion ? false : { opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .16 }} transition={{ duration: .8, delay: .08 }}>
          <span className="chapter-number">07 / EVIDENCE</span><h2>Performance makes settlement eligible.</h2><p>Evidence does not independently move value. It proves whether the Pact's settlement conditions have been met.</p>
          <div className="proof-steps"><span>RECEIPT CAPTURED</span><DrawLine /><span>PAYCARD EVENT MATCHED</span><DrawLine /><span>PACT BINDING VERIFIED</span><DrawLine /><strong>SETTLEMENT ELIGIBLE</strong></div>
          <small>WALLET CONFIRMATION STILL REQUIRED</small>
        </motion.div>
      </section>

      <section className="settlement-climax">
        <div className="settlement-copy"><Reveal><span className="chapter-number">08 / SETTLE</span><h2>The rail becomes active with its full commercial context attached.</h2></Reveal><Reveal delay={.08}><p>Workspace, Path, decision, Pact, and Proof explain why the rail may execute. The wallet approves the financial action. The network receipt makes the outcome canonical.</p></Reveal></div>
        <div className="context-strip">{['WORKSPACE 01', 'PATH 04 / REV 07', 'PROPOSAL 018', 'BAPHOMET ALLOW', 'PACT 2048', 'PROOF APPROVED'].map((item, index) => <motion.span key={item} initial={reduceMotion ? false : { opacity: .2, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }}>{item}</motion.span>)}</div>
        <div className="settlement-rail"><span>PAYER</span><i><motion.b animate={reduceMotion ? { left: '50%' } : { left: ['2%', '92%'] }} transition={{ duration: 5, ease: 'linear', repeat: Infinity }} /><motion.em animate={reduceMotion ? undefined : { scaleX: [0, 1], opacity: [.15, .8] }} transition={{ duration: 5, ease: 'linear', repeat: Infinity }} /></i><span>RECIPIENT</span></div>
        <div className="settlement-economics"><Reveal><span>RAILSFLOW</span><strong>VELOCITY CONTROLLED SETTLEMENT</strong></Reveal><Reveal delay={.08}><span>PAYCARD</span><strong>CANONICAL FINANCIAL STATE</strong></Reveal><Reveal delay={.16}><span>STN-DELTA</span><strong>EARNED / RESIDUAL ROUTING</strong></Reveal></div>
        <motion.div className="receipt-sheet" initial={reduceMotion ? false : { opacity: 0, rotate: -1.5, y: 38 }} whileInView={{ opacity: 1, rotate: -.3, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: .85 }}><span>{ACTIVE_NETWORK.shortName} RECEIPT</span><div><small>CHAIN</small><strong>{ACTIVE_NETWORK.chainId}</strong></div><div><small>ALLOCATION</small><strong>420 orUSD</strong></div><div><small>STATUS</small><strong>CONFIRMED</strong></div><div><small>PROVENANCE</small><strong><i /> LIVE ON {ACTIVE_NETWORK.shortName}</strong></div></motion.div>
      </section>

      <section className="resolution-architecture">
        <div className="resolution-copy"><Reveal><span className="chapter-number">09 / EXCEPTION</span><h2>Failure remains inspectable.</h2></Reveal><Reveal delay={.08}><p>When normal execution fails, OpenRails preserves the authority, agreement, evidence, and financial history that led there. Gaia applies only bounded determination and rectification terms already attached to the Pact.</p></Reveal></div>
        <div className="normal-exception"><motion.div initial={reduceMotion ? false : { opacity: .2 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}><span>NORMAL EXECUTION</span><DrawLine /><strong>SETTLED</strong></motion.div><motion.div initial={reduceMotion ? false : { opacity: .2 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: .1 }}><span>EXCEPTION</span><DrawLine /><strong>GAIA CASE → EVIDENCE → RECTIFICATION</strong></motion.div></div>
        <div className="complete-architecture">
          <Reveal><article><span>CONTROL RUNTIME</span><strong>Workspace · Path · Baphomet · Pact · Proof · Gaia</strong><p>Authorises, contextualises, and preserves commercial state.</p></article></Reveal>
          <motion.i animate={reduceMotion ? undefined : { y: [0, 8, 0] }} transition={{ duration: 2.6, repeat: Infinity }}>↓</motion.i>
          <Reveal delay={.08}><article><span>SETTLEMENT PROTOCOL</span><strong>RailsCard · RailsFlow · Paycard · Vault · STN-Delta</strong><p>Moves value through bounded, wallet authorised rails.</p></article></Reveal>
          <motion.i animate={reduceMotion ? undefined : { y: [0, 8, 0] }} transition={{ duration: 2.6, repeat: Infinity, delay: .2 }}>↓</motion.i>
          <Reveal delay={.16}><article><span>NETWORK</span><strong>{ACTIVE_NETWORK.shortName} today · Arc and other deployments through adapters</strong><p>Preserves canonical contract events and transaction receipts.</p></article></Reveal>
        </div>
      </section>

      <section className="narrative-final">
        <Reveal><span className="tech-label">OPENRAILS / COMPLETE SYSTEM</span>
        <h2>Move value at the speed of software.<br /><span>Keep authority, context, and control.</span></h2></Reveal>
        <div className="destination-grid">
          <Reveal><Link to="/system"><span>01 / PROVE</span><strong>Enter System Lab</strong><p>Operate the permitted and blocked lifecycle.</p><b>↗</b></Link></Reveal>
          <Reveal delay={.08}><Link to="/docs"><span>02 / UNDERSTAND</span><strong>Read documentation</strong><p>Learn the protocol, Runtime, integration model, and security boundaries.</p><b>↗</b></Link></Reveal>
          <Reveal delay={.16}><Link to="/network"><span>03 / VERIFY</span><strong>Inspect deployment</strong><p>Review contracts, wallet state, faucet, and canonical evidence.</p><b>↗</b></Link></Reveal>
        </div>
      </section>
    </main>
  );
}
