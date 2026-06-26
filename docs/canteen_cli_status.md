# OpenRails V1: arc-canteen CLI Profile & Status

This document captures the authentication profile, network RPC endpoints, and commands for tracking progress and submitting updates via the `arc-canteen` CLI tool.

> [!NOTE]
> Planning and analysis note. Confirm current implementation before treating any item as shipped.

---

## 1. Developer Profile Credentials

Running `arc-canteen status` returns the following verified credentials for the active workspace:

* **GitHub User:** `@Jaydearcadian`
* **Discord Handle:** `@Jaydeculein`
* **Telegram Handle:** `@Jaydeculein`
* **Email Address:** `supremacy817@gmail.com`

---

## 2. Configured RPC Endpoint

The CLI is configured with an active custom RPC node embedding a private server authorization token:
```
https://rpc.testnet.arc-node.thecanteenapp.com/v1/REDACTED_RPC_TOKEN
```
This RPC URL routes requests to the Arc Testnet and should be used to deploy or interact with contracts on Arc.

---

## 3. Reference Commands for Hackathon Submission

Use the following commands to log progress directly to the Canteen platform:

### A. View Profile & Sync Status
* **Show Dashboard:** Display credentials, RPC settings, and recent submission logs:
  ```bash
  arc-canteen status
  ```
* **List History:** View all previously logged updates:
  ```bash
  arc-canteen ls
  ```

### B. Submit Progress Updates
* **Update Product Progress:** Share feature, code, or design specs (such as our new sidecar blueprints):
  ```bash
  arc-canteen update-product
  ```
* **Update User Traction:** Log details about user validation, onboarding, or community chats:
  ```bash
  arc-canteen update-traction
  ```

### C. Retrieve Agent Context Documentation
* **Export Context:** Print developer docs and sample codebases (e.g., `arc-commerce`, `arc-escrow`) to supply background to agent builders:
  ```bash
  arc-canteen context
  ```
