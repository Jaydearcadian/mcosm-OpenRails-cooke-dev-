# Technical Blueprint: Playback Synchronization & Settlement Flow

This document details how music playback events (listening, pausing, skipping) in a media player are synchronized with off-chain sidecars and on-chain smart contract settlement/flushing.

---

## 1. Sequence of Synchronized Actions

```
[ Navidrome Client ]            [ Sidecar Daemon ]           [ Arc Hub Contract ]
        │                               │                             │
        ├─── 1. Play Track ────────────►│                             │
        │                               ├─── 2. Sign & Relay Open ───►│ (Escrow Buffer Locked)
        │                               │                             │
        │                               │◄── 3. Confirmed ────────────┤
        │                               │                             │
        │                               │   *Local Timer Starts*      │
        │                               │                             │
        ├─── 4. Pause / Skip ──────────►│                             │
        │                               ├─── 5. Sign & Relay Close ──►│ (Settle Earned + 
        │                               │                             │  Refund Leftover)
```

---

## 2. Event Mechanics

### Action 1: Playback Start (Play Event)
1. **Trigger**: A listener plays a track in the media client (Navidrome).
2. **Detection**: Navidrome hits the mock ListenBrainz endpoint exposed by the local sidecar: `POST /apis/listenbrainz/1/submit-listens`.
3. **Open Intent**: The sidecar:
   * Extracts the MusicBrainz Artist ID (`artist_mbids[0]`).
   * Queries the on-chain `MusicBrainzRegistry` to resolve the artist's EVM wallet address.
   * Signs an EIP-712 settlement envelope with a specified budget cap (e.g. $0.05 USDC) and flow velocity (e.g. $0.0001 USDC/second).
   * Relays the envelope to the OpenRails Gateway.
4. **On-Chain Escrow**: The Gateway submits the transaction to the Vault contract (`_openPaycardChannel`). The Vault locks the USDC buffer.
5. **Dashboard Sync**: The Cockpit Dashboard receives the event and renders the stream card as **"Active"**, starting a visual timer.

### Action 2: Continuous Listen (Drip Accrual)
1. **Trigger**: The listener keeps the song playing.
2. **Synchronization**: To prevent gas waste, no on-chain transactions are sent during active listening. Both the off-chain client (dashboard UI) and the on-chain Vault keep a synchronized timer based on the block timestamp. The balance increments locally at the rate of `flowVelocityPerSecond`.

### Action 3: Playback End (Pause, Skip, or Exit Event)
1. **Trigger**: The listener pauses the music, skips the track, or closes the player.
2. **Detection**: Navidrome sends a state change update to the sidecar, or the sidecar detects a session heartbeat loss.
3. **Settle and Flush**:
   * The sidecar signs a final settlement request with the exact duration played (e.g., 42 seconds) and calls `flushResidualDelta` via the Gateway API.
   * The Hub contract calculates:
     $$\text{Earned Value} = 42\text{ seconds} \times \text{flowVelocityPerSecond}$$
   * The contract transfers the earned USDC to the artist's wallet, and instantly releases the remaining buffer (original escrow - earned value) back to the user's wallet.
4. **Dashboard Sync**: The Cockpit dashboard marks the stream as **"Settled"** and updates the user's balance.
