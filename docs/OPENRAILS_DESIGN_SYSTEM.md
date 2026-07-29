# OpenRails product design system

This document preserves the design language used by the OpenRails narrative, System Lab, network evidence surface, build surface, documentation, and future personal dashboard.

## Product surfaces

| Route | Purpose |
| --- | --- |
| `/` | Persuade and narrate the evolution from programmable rails to accountable commerce. |
| `/system` | Prove one permitted and one blocked lifecycle. |
| `/network` | Expose canonical deployment, wallet state, contracts, and receipts. |
| `/build` | Explain architecture and integration boundaries. |
| `/docs` | Provide the operating and technical manual. |
| `/app` | Future account-centred operating dashboard. |

## Canonical visual rules

- Canvas `#F3F1EC`
- Surface `#FFFFFF`
- Ink `#0B0A09`
- Dark copy `#4E4B47`
- Muted metadata `#9C9992`
- Hairline `#D8D4CC`
- Panel `#E8E5DF`
- Signal coral `#D96543`
- Editorial type: Inter Tight
- Technical type: Doto

Coral is semantic, not decorative. It marks current movement, pending execution, wallet confirmation, active selection, or unresolved state. Completed and canonical state returns to black.

## Network portability

The design system is OpenRails-wide and must remain independent of GIWA, Arc, or any later deployment. Network identity is expressed through configuration and evidence labels, never through a separate visual theme.

Each network adapter supplies:

- network name and chain ID;
- native gas symbol;
- settlement assets;
- RPC and explorer URLs;
- deployed contract addresses;
- receipt and event links;
- live/recorded/demonstration provenance.

The reusable implementation lives in `packages/openrails-design-system`.
