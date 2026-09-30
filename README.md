# TraceX

Explainable nearest-VASP attribution for unknown crypto wallets, integrated with SAHYOG.
Smart India Hackathon 2026 | Problem Statement SIH26182 | Theme: Blockchain & Cybersecurity | Team Trinetra

## What it does
Given a suspect wallet, TraceX finds the nearest exchange (VASP) or stablecoin issuer that can act on a lawful request, shows the evidence and confidence, and prepares a request package for SAHYOG.

A wallet owner cannot be identified from the chain alone. TraceX finds the right VASP fast, so a lawful request can be served while funds can still be frozen.

## Features in this prototype
- Case intake: extracts wallet addresses and transaction hashes from complaint text and detects the chain
- Nearest-VASP best-first search with hop and API-call budgets
- Top candidates with an explainable confidence formula and evidence list
- Recoverable-amount estimate (proportional method) and freeze-urgency score
- Request package for SAHYOG (mock submission)
- SHA-256 hash-chained audit ledger with Verify integrity and Simulate tampering
- Live mode for Tron (TRC20 USDT) via the public TronGrid API

## Real vs planned
Demo cases use seeded fictional data and are labelled SEEDED DEMO DATA.
Planned: Ethereum and Bitcoin live tracing, behavioural exchange-deposit detection on live data, watch mode, PDF export, real SAHYOG integration, provider API adapters.

## Run locally
npm install
npm run dev

## Notes
- Only wallet addresses are sent to external APIs, never personal data.
- The labels table is empty by default. Import publicly sourced exchange labels as CSV (address,entity,type,source).
