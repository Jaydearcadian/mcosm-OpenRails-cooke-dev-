# Architectural Specification: Stream Pause & Resume Mechanics

This document evaluates the implementation of a pause/resume capability for OpenRails Paycard Streams, comparing **On-Chain State Pausing** against **Off-Chain Lazy-Flushing**.

---

## 1. The Design Choice

When a user pauses music or a service session, we have two ways to handle the payment stream:

| Feature | Option A: On-Chain Pause Contract | Option B: Off-Chain Lazy-Flush (Recommended) |
| :--- | :--- | :--- |
| **Transaction Gas** | High (Requires gas on every pause/resume) | Low (Only pays gas on initial open and final exit) |
| **Signature Friction**| Zero (Keeps the original EIP-712 envelope alive) | Zero (Keeps the original EIP-712 envelope alive) |
| **UX Speed** | Slow (Delayed by block finality on pause) | Instant (Immediate Web2-like pause response) |
| **Capital Lockup** | Funds remain escrowed until manual resume/flush | Funds remain escrowed until timeout flush |

---

## 2. Option A: On-Chain Pause Module
In this model, the smart contract is modified to support `pauseStream` and `resumeStream` functions.

```solidity
struct PaycardStream {
    uint256 totalAllocation;
    uint256 velocity;
    uint256 lastCheckpoint;
    uint256 accruedDebt;
    bool isPaused;
}
```

* **When Paused**: The sidecar triggers `pauseStream(paycardId)`. The contract calculates the elapsed time since `lastCheckpoint`, adds the earned USDC to `accruedDebt`, and sets `isPaused = true`. The stream velocity is effectively set to 0.
* **When Resumed**: The sidecar triggers `resumeStream(paycardId)`. The contract sets `isPaused = false` and updates `lastCheckpoint = block.timestamp`.
* **The Problem**: If a listener pauses a song three times to take a phone call, they must trigger three separate on-chain transactions, wasting gas.

---

## 3. Option B: Off-Chain Lazy-Flushing (The Recommended Approach)
Instead of touching the blockchain on pause, the sidecar and gateway handle the pause **entirely off-chain** using a timer offset:

```
[Play] ────► [Pause] (Local Timer logs offset) ────► [Resume] (Accumulates offset) ────► [Exit / Timeout] (Flush)
```

### How the Sync Works:
1. **Pause Event**: Listener clicks pause in Navidrome. The sidecar logs `pausedAt = Date.now()`. It does **not** send an on-chain transaction.
2. **Resume Event**: Listener clicks play again. The sidecar calculates the paused duration:
   $$\Delta t_{\text{paused}} = \text{Date.now()} - \text{pausedAt}$$
   It appends this duration to a local accumulator: `totalPausedTime += elapsed`.
3. **Timeout or Song Change (The Lazy Flush)**:
   * If the listener changes the song, or remains paused for more than **5 minutes** (timeout limit), the sidecar terminates the session.
   * It calculates the exact active duration:
     $$\text{Active Play Time} = \text{Total Time} - \text{totalPausedTime}$$
   * It submits the final `flushResidualDelta` transaction with the adjusted time.

---

## 4. Summary Recommendation
Implement **Option B (Off-Chain Lazy-Flushing)** inside the sidecar client. 

This keeps the on-chain Solidity contracts simple, lightweight, and secure, while providing a **zero-gas, zero-latency, and zero-signature UX** for listeners pausing and resuming their streams.
