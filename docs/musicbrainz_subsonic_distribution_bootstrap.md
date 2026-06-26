# OpenRails V1: MusicBrainz & Subsonic Distribution Bootstrap

This document details the design and launch plan for the **Subsonic Scrobble Sidecar** and **MusicBrainz Payee Registry**, targeting immediate user distribution and transaction traction by integrating with existing open-source music communities.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. The Strategy: Attaching Payments to Existing Audiences

To solve the distribution bottleneck, OpenRails avoids launching a new payment application from scratch. Instead, it acts as a **monetization sidecar** for established self-hosted music server communities (like Navidrome, Koel, or the Subsonic client family Feishin).

By mapping MusicBrainz Artist IDs (MBID) to wallet addresses, OpenRails enables **user-centric streaming micro-royalties** directly from listeners to artists, completely bypassing centralized streaming distributor fees.

```
┌─────────────────┐             ┌────────────────────────┐             ┌──────────────────┐
│ SUBSONIC CLIENT │             │  OPENRAILS SCROBBLER   │             │   MUSICBRAINZ    │
│  (Feishin/Koel) │             │        SIDECAR         │             │  PAYEE REGISTRY  │
└────────┬────────┘             └───────────┬────────────┘             └────────┬─────────┘
         │                                  │                                   │
         │───(1. Scrobble: Song Played)────►│                                   │
         │                                  │───(2. Query Artist Wallet/MBID)──►│
         │                                  │◄──(3. Return Wallet Address)──────│
         │                                  │
         │                                  ▼
         │                      [ OpenRails Client SDK ]
         │                  (Signs envelope & escrows USDC)
         │                                  │
         │                                  ▼
         │                        [ ArcOpenRailsHub ]
         │                  (Verifies signature & settles)
```

---

## 2. Architecture & Components

### 2.1 The MusicBrainz Payee Registry (`MusicBrainzRegistry.sol` / Database)
A lookup registry mapping a unique **MusicBrainz Artist ID (MBID)** to a recipient's EVM wallet address.
* **Why it matters:** Music metadata managers (like Beets and Picard) already tag tracks with the artist's MBID. The registry acts as the routing lookup for payouts.
* **Storage:** Can be deployed as a simple off-chain indexed database or a lightweight lookup smart contract:
  ```solidity
  contract MusicBrainzRegistry {
      // Maps MBID string to creator wallet
      mapping(string => address) public artistWallets;
      event WalletRegistered(string indexed mbid, address indexed wallet);
  }
  ```

### 2.2 The Subsonic Scrobble Sidecar Daemon
A lightweight off-chain service (daemon) running on the user's local server alongside their Subsonic instance (e.g., Navidrome).
* **How it works:** Subsonic servers emit "scrobble" events when a track plays (e.g., via SQLite query polling or webhook logs).
* **Payment Dispatch:** Upon catching a scrobble event:
  1. The daemon extracts the `artist_mbid` from the track tags.
  2. It queries the `MusicBrainzRegistry` for the artist's wallet address.
  3. It uses the [LeptonOpenRailsClient](../sdk/src/client.ts) to compile and sign an EIP-712 envelope.
  4. It submits the envelope to the Relayer Gateway, opening a micro-drip stream (e.g., 0.001 USDC) or executing an instant settlement directly to the artist.

---

## 3. Step-by-Step Traction & Deployment Plan

### Step 1: Release the Sidecar as a Docker Container
Package the Scrobble Sidecar as a Docker image. Self-hosted administrators can deploy it in their existing `docker-compose.yml` configs with a single command:
```yaml
services:
  navidrome:
    image: deluan/navidrome:latest
    ...
  openrails-sidecar:
    image: openrails/scrobble-sidecar:latest
    environment:
      - SUBSONIC_URL=http://navidrome:4533
      - OPENRAILS_GATEWAY_URL=http://gateway.arc.io
      - PAYER_PRIVATE_KEY=0x...
```

### Step 2: Open-Source Registry Portal
Launch a simple frontend where artists paste their MusicBrainz MBID, connect their EVM wallet, and sign a verification message to bind their wallet address. This establishes the payee mapping database.

### Step 3: Upstream PR or Client Plugin
Develop a plugin for popular frontend clients like **Feishin** or **Supersonic**. This lets listeners see their real-time OpenRails streaming balances and direct royalty outflows natively in the music player interface.
