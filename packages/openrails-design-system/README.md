# OpenRails Design System

The network-neutral visual and product-language source of truth for OpenRails surfaces.

## What is fixed

- Warm editorial canvas, black structural ink, one coral execution signal.
- Inter Tight for narrative and interface copy.
- Doto for IDs, receipts, state, chain data, timestamps, and provenance.
- Hairline borders, architectural spacing, restrained motion, no gradients or glassmorphism.
- Coral means active movement, unresolved state, wallet boundary, or pending execution. Canonical/completed state returns to black.

## What may vary by network

Contract addresses, native gas symbol, settlement asset, explorer URLs, RPC details, chain ID, and provenance evidence. Network branding must not replace the OpenRails visual hierarchy.

## Usage

```css
@import '@openrails/design-system/tokens.css';
```

The package intentionally contains no GIWA- or Arc-specific token. Product surfaces should consume network data through configuration, not through theme forks.
