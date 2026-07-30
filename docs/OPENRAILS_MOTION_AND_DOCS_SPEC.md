# OpenRails motion and documentation specification

## Homepage motion

The page retains the approved editorial layout. Motion makes one economic action legible as it becomes authority, commitment, evidence, and settlement.

The motion system uses:

1. a two-pixel route progress signal;
2. slow grid movement and one coral scan line in the hero;
3. bounded pool rings and a value packet moving through the rail;
4. line drawing for transfer, binding, Proof, and exception routes;
5. staged ALLOW and BLOCK reveals;
6. a printed receipt arrival at the settlement climax;
7. a persistent signal across the settlement primitive grid;
8. reduced-motion behavior that preserves every label, heading, and diagram.

Essential copy must never depend on an animation finishing. Hover states may change background, border, and emphasis, but they must not reduce text contrast or hide content.

## Documentation information architecture

The documentation is an operating manual with five layers:

- Introduction;
- Settlement Protocol;
- Control Runtime;
- Build;
- Network and Security.

Each page contains:

- a one-sentence definition;
- what the primitive creates;
- what it does not do;
- narrative explanation;
- a visual model;
- object fields and boundaries;
- state and execution flow;
- failures and safe recovery;
- a worked 420 orUSD example;
- implementation references;
- a direct link to the System Lab.

## Documentation viewport

The fixed global header sits outside the documentation reading viewport. The left navigation, article, and right contents rail each occupy a stable region. Only the article is the primary reading scroll container. Route changes reset that container before the new document appears.

## Navigation and route behavior

- the OpenRails wordmark always returns to `/`;
- the global shell remains mounted;
- route content changes without a blank fade;
- window and route-owned scroll positions reset before presentation;
- unknown routes redirect to `/`;
- documentation navigation uses real links;
- section navigation scrolls the article container rather than the browser window.
