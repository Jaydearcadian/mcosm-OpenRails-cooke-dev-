# OpenRails product web v5.2 hardening

## Purpose

v5.2 hardens the approved v5.1 visual direction. It does not replace the homepage, System Lab, Network page, Build page, wallet boundary, Agent Kernel gateway, or settlement flow.

## Route behavior

- The global shell remains mounted during client navigation.
- The route surface no longer fades through a blank state.
- Window scroll and route-owned scroll regions reset before the destination is presented.
- The OpenRails wordmark remains the homepage return control.
- Documentation routes use one controlled reading viewport beneath the fixed header.

## Documentation shell

On wide screens the docs surface contains three stable regions:

1. a left navigation and search rail;
2. one primary article scroll region;
3. a right "On this page" rail with active-section tracking.

The global footer is omitted from docs routes because previous and next documentation controls close the reading surface.

## Operating detail model

Every documentation page now adds five structured layers after the narrative and visual model:

- object model;
- state and execution model;
- failure and recovery matrix;
- worked canonical example;
- implementation references.

The same 420 orUSD example connects the protocol, Runtime, wallet, network, and exception pages.

## Motion integrity

Essential homepage copy is never hidden by hover or reveal state. Motion is limited to borders, signal progression, rail traces, diagram entrances, and state transitions. Reduced-motion behavior keeps all information visible.

## Network portability

The active network label and core web deployment metadata are read through `src/data/network.ts`. The product visual language and object model remain OpenRails-wide. Network adapters provide chain identity, gas currency, settlement assets, contracts, explorer links, and receipt rules.
