# AGENTS.md

## Project overview
This repository contains active software development work.
Agents must preserve existing architecture, keep diffs scoped, and prefer incremental changes over broad rewrites.
This repository is blockchain and web3 focused, so agents must account for smart contracts, wallets, signatures, chain configuration, RPC dependencies, indexers, and transaction lifecycle behavior when relevant.

## How to work
- Read nearby files and existing patterns before editing anything
- Prefer minimal, reversible diffs
- Do not modify unrelated files
- Stop and report if requirements are ambiguous, conflicting, or under-specified
- Do not invent APIs, environment variables, services, package managers, or commands that are not present in the repo
- When behavior changes, update tests and docs in the same pass
- When a task is large or cross-cutting, produce a short plan before implementation
- Do not expand scope beyond the approved plan without explicit approval
- If implementation reveals a required out-of-scope file or dependency, stop and report it before proceeding

## Command discovery policy
- Do not assume the package manager, task runner, or service manager
- First inspect the repository to discover the real workflow
- Look for commands in:
  - `README.md`
  - `package.json`
  - `pyproject.toml`
  - `requirements.txt`
  - `Cargo.toml`
  - `Makefile`
  - `justfile`
  - `docker-compose.yml`
  - `.github/workflows/`
  - `scripts/`
- Prefer commands already used by the repository or CI
- If multiple command systems exist, prefer the one used in CI or documented in the repo
- If commands are still unclear, report what was found and ask before using destructive or broad workflows

## Core commands
Replace these only when the actual repo commands are known.

- Install dependencies: `<replace with actual command>`
- Start dev server: `<replace with actual command>`
- Run lint: `<replace with actual command>`
- Run typecheck: `<replace with actual command>`
- Run tests: `<replace with actual command>`
- Run build: `<replace with actual command>`

## Execution mode
- Start with analysis, then planning, then implementation, then verification
- For risky or cross-cutting changes, ask for confirmation before broad refactors
- For small bug fixes, prefer the smallest change that fully resolves the issue
- Use existing abstractions before introducing new ones
- Avoid speculative cleanup during feature delivery

## Validation rules
- Run the narrowest relevant validation first
- Preferred validation order: targeted test -> scoped lint/typecheck -> broader project validation
- For blockchain or web3 changes, prefer the narrowest changed-surface validation first: contract -> generated types or ABI checks -> indexer or event consumer -> backend/service -> frontend
- If a UI-only change was made, run the most relevant frontend validation before a full build when possible
- If public behavior changed, run tests that cover the changed path
- Discover and use contract tests, fork tests, local chain or devnet flows, ABI or codegen checks, and frontend integration tests when they exist
- Never claim success without reporting what validation was actually run
- If validation cannot run, say exactly why
- If validation is blocked by missing RPC endpoints, wallets, keys, addresses, chain configuration, or other web3 prerequisites, report that explicitly
- If commands are unknown, report the command discovery results instead of guessing

## Definition of done
A task is only done when all of the following are true:
- The requested change is implemented
- Relevant validation was run, or the inability to run it is explained clearly
- No unrelated files were changed
- Docs are updated if setup, API, behavior, or workflows changed
- Risks, assumptions, and follow-ups are called out clearly

## Droid orchestration
- `workflow-coordinator` is the default entrypoint for non-trivial tasks
- `repository-researcher` runs before planning when codebase impact is unclear
- `implementation-planner` produces the approved file list, acceptance criteria, and execution plan before edits
- `architecture-droid` should be used when structural changes, module boundaries, or layering concerns are involved
- `system-design-droid` should be used when a task spans services, jobs, storage, auth, caching, queues, or operational design
- `ui-ux-droid` should be used for user journey, task flow, navigation, accessibility, and interaction design concerns
- `frontend-droid` should be used for UI architecture, routes, components, state flow, and client-side integration
- `implementation-droid` should only edit files approved in the plan unless scope is explicitly expanded
- `validation-droid` must report actual commands run and actual failures; it must never infer passing results
- `principal-reviewer` runs after validation and before completion
- `documentation-droid` is required when setup, behavior, API, or workflow changes
- `delivery-notes-droid` prepares final PR or release notes for human review
- The default stage order is: research -> planning -> optional architecture/system/ui review -> implementation -> validation -> review -> docs if needed -> delivery notes
- If validation fails, route back to `implementation-droid` with the narrowest failing surface
- If review finds blockers, route back to `implementation-droid` with the smallest fix path
- If requirements are ambiguous or the plan must expand, stop and ask for approval before continuing
- Treat smart contract, signing, wallet, approval, asset movement, chain configuration, ABI, and indexer changes as high-risk paths
- Use `system-design-droid` for cross-service, onchain, queue, ingestion, or observability changes
- Use `principal-reviewer` for any contract, signature, auth, permission, wallet, or asset-moving path before declaring success
- Require rollout and rollback notes for contract deployments, address changes, ABI changes, indexer/schema changes, or irreversible migration steps

## Project structure
Edit this section to match the real repository.

- `apps/` → application entrypoints
- `packages/` → shared libraries or modules
- `services/` → backend or infrastructure services
- `docs/` → product, engineering, and operational docs
- `scripts/` → automation and developer tooling
- `infra/` → deployment or infrastructure configuration

Rules:
- Frontend-only code should stay in frontend areas
- Backend-only code should stay in backend or service areas
- Shared logic should not import app-specific code unless the repo already does this intentionally
- Avoid circular dependencies across packages or modules
- Keep contract code, generated artifacts, indexers, backend services, and frontend clients separated by clear boundaries when the repo contains those layers

## Coding conventions
Adjust to the stack once the repo conventions are clear.

- Reuse existing utilities before adding new dependencies
- Keep functions and modules focused and cohesive
- Prefer descriptive names over short clever names
- Avoid unnecessary abstraction
- Keep comments high-signal; explain why, not obvious mechanics
- Do not silence errors with broad ignores or unsafe shortcuts unless justified
- Follow the repo’s existing formatting, typing, and naming patterns

## Testing expectations
- Add or update tests when fixing logic bugs or changing behavior
- Prefer targeted tests close to the changed code
- For regressions, reproduce the failure first when practical
- If a test is skipped or deferred, explain why and what remains at risk
- If the repo has no tests in the touched area, call that out explicitly

## Frontend expectations
Use this section if the repo contains UI work.

- Reuse existing design-system components, styles, and tokens
- Design for loading, empty, error, success, and disabled states
- Design wallet-aware states when relevant: connected, disconnected, wrong-network, insufficient-balance, pending-signature, pending-confirmation, confirmed, and failed
- Keep accessibility first-class: semantics, keyboard support, labels, focus visibility, and contrast
- Verify responsive behavior when layout is affected
- Avoid visual churn unless the task explicitly requests UI redesign
- Prefer clear user flows over flashy interactions
- Make fees, slippage, approvals, transaction status, and irreversible actions explicit when the product surface involves them

## API and backend expectations
Use this section if the repo contains backend or service work.

- Preserve backward compatibility unless the task explicitly allows breaking changes
- Validate inputs at boundaries
- Handle errors explicitly and return useful messages
- Consider auth, permissions, rate limits, and data exposure in every endpoint or service change
- Add logging, metrics, or tracing when operational visibility matters
- Do not assume immediate transaction finality or immediate consistency after submission
- Account for retries, idempotency, reorgs, nonce or ordering issues, and RPC/provider unreliability when interacting with chains or indexers

## Data and migrations
- Do not perform destructive schema or data changes without calling them out explicitly
- For migrations, include rollback or mitigation notes
- If data shape changes, update serializers, validators, and dependent clients
- Make data assumptions explicit
- If contract events, ABIs, generated types, addresses, or indexer schemas change, update all dependent consumers and document deployment order
- Call out when rollback is limited or impossible after contract deployment, emitted data changes, or irreversible onchain actions

## Security rules
- Never hardcode secrets, tokens, or credentials
- Never hardcode private keys, seed phrases, RPC secrets, privileged addresses, or signing credentials
- Do not print secrets into logs, tests, docs, or sample configs
- Flag risky auth, permission, injection, deserialization, or data exposure issues
- Prefer least-privilege changes
- Call out any new external dependency or third-party service use
- Review signature verification, replay protection, approval scope, access control, precision or rounding, and asset movement paths carefully

## Git and PR expectations
- Keep branches and commits focused
- Summarize what changed, why, validation run, risks, and rollback notes
- Do not mix refactors with behavior changes unless necessary
- If a change is risky, include a short rollout or fallback plan

## Output format for agents
When completing a task, report:
- Summary
- Files changed
- Validation run
- Risks or follow-ups
- Docs/tests updated or not updated

## Repo-specific knowledge
Fill this section with confirmed project details only.

- Main app entrypoint: `<replace>`
- Supported chains: `<replace>`
- Contract package or directory: `<replace>`
- ABI or generated types location: `<replace>`
- RPC providers: `<replace>`
- Indexer or subgraph location: `<replace>`
- Wallet provider or auth approach: `<replace>`
- Primary database: `<replace>`
- Auth system: `<replace>`
- Deployment target: `<replace>`
- Observability stack: `<replace>`
- Key external services: `<replace>`

## Anti-patterns to avoid
- Editing unrelated files
- Renaming or moving files without strong reason
- Rewriting large areas for style only
- Adding dependencies without need
- Skipping validation and still claiming completion
- Creating duplicate utilities when one already exists
- Building features that were not requested
- Guessing commands instead of discovering them

## Escalate when
Agents should stop and ask for guidance when:
- Requirements are ambiguous
- The change affects security, auth, billing, or production infrastructure
- A migration or breaking API change is required
- The repo state is inconsistent or already failing in unrelated ways
- The needed command, service, or dependency is missing
- Multiple possible workflows exist and the repo does not clearly indicate which one is canonical

## Monorepo note
If this is a monorepo or a multi-surface repo, add nested `AGENTS.md` files inside major apps, services, or packages when local rules differ.
The nearest `AGENTS.md` should be treated as the most specific source of truth.
