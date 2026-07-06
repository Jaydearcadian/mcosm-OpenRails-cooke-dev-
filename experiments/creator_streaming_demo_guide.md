# Playbook: Live Creator Streaming Demo & Verification Guide

This playbook defines the environment setup, runtime orchestration, testing scripts, and screen-recording guidelines to showcase the OpenRails creator streaming royalty pipeline.

---

## 1. Live Runtime Architecture (The Stack)

To run the live demo, four independent processes must run concurrently:

```
┌────────────────────────┐              ┌────────────────────────┐
│  1. Navidrome (Music)  │ ──(Scrobble)►│  2. Sidecar (Listener) │
│  Docker Port: 4533     │              │  Node Port: 3002       │
└────────────────────────┘              └───────────┬────────────┘
                                                    │
                                                    ▼ (EIP-712 Envelope)
┌────────────────────────┐              ┌────────────────────────┐
│ 4. Cockpit (Dashboard) │◄──(Index)────│  3. Gateway Relayer   │
│ Vite Port: 5173        │              │  Express Port: 3001    │
└────────────────────────┘              └────────────────────────┘
```

---

## 2. Step-by-Step Test Environment Setup

Follow these steps to spin up the local sandbox stack before recording:

### Step 1: Launch Blockchain & Relayer Gateway (Terminal 1)
```bash
npm start
```
*Deploys the smart contracts and starts the Express gateway on port `3001`.*

### Step 2: Deploy Registry & Set Up Mock Artist (Terminal 2)
Deploy the registry contract and map the test artist's MBID to a wallet address:
```bash
npx hardhat run scripts/deploy-registry.ts --network localhost
```
*Verify that `e12de7b9-ee26-47e1-884b-a7f4fa1dae68` (Daft Punk) is mapped to your recipient test address.*

### Step 3: Run the ListenBrainz Sidecar (Terminal 3)
Ensure the sidecar runs on port `3002` with the correct contract addresses:
```bash
OPENRAILS_PAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
ARC_OPENRAILS_HUB_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
MUSICBRAINZ_REGISTRY_ADDRESS=<registry_address> \
ts-node experiments/musicbrainz-subsonic/bridge-tokens.ts
```

### Step 4: Configure Navidrome (Docker)
Ensure your Navidrome instance points to the local sidecar:
```yaml
environment:
  ND_LISTENBRAINZ_ENABLED: "true"
  ND_LISTENBRAINZ_BASEURL: "http://host.docker.internal:3002/apis/listenbrainz/"
```

---

## 3. Pre-Flight QA Checklist (Avoiding Demo Failures)

Before pressing "Record", verify these three critical failure points:

1. **Audio File ID3 Tags (Crucial)**: 
   Navidrome relies entirely on files having correct metadata. Your test `.mp3` file **must** have the `MUSICBRAINZ_ARTISTID` tag containing the registered MBID (`e12de7b9-ee26-47e1-884b-a7f4fa1dae68`). You can write this metadata using **MusicBrainz Picard** or **Beets** before adding the file to Navidrome's library.
2. **USDC Token Allowance**: 
   Ensure the listener's wallet has pre-approved the `ArcOpenRailsHubV1` contract to transfer USDC, otherwise the open transaction will fail with a revert error.
3. **Wallet Gas Funding**: 
   The relayer wallet must have a small balance of gas tokens (native Arc Gas / USDC) to submit the transaction envelopes.

---

## 4. Screen-Recording Storyboard (Loom / OBS Capture)

Follow this chronology for a flawless, single-take video capture:

* **0:00 - 0:15 (The Setup)**:
  * *Screen*: Show the Cockpit Streams dashboard on the right, and the Navidrome player on the left.
  * *Narrative*: Connect your wallet. Point to the $0.00 active streaming rate. *"Here we have our empty streaming deck. No payments are active."*
* **0:15 - 0:45 (The Listen)**:
  * *Screen*: Click play on the Daft Punk track inside Navidrome.
  * *Narrative*: Let the song play. *"We are playing 'Get Lucky'. Our local sidecar is monitoring playback."*
* **0:45 - 1:15 (The Trigger)**:
  * *Screen*: Fast-forward the song timeline past 50% to trigger the scrobble. Instantly show the Sidecar terminal log firing.
  * *Narrative*: *"As the song crosses the scrobble threshold, Navidrome sends the log. The sidecar resolves the artist's MBID on-chain and opens the USDC stream. Look at the Cockpit: the balance is now actively dripping to the artist's wallet."*
* **1:15 - 1:30 (The Flush & Sweep)**:
  * *Screen*: Click pause on Navidrome. Show the stream closing on Cockpit and the remaining balance returning.
  * *Narrative*: *"We pause the track. The stream terminates. The artist keeps exactly what they earned for those seconds, and the leftover safety buffer sweeps back to the user."*
