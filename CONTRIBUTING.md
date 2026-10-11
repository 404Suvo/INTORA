# Contributing to Intora

Thank you for your interest in contributing to **Intora**!

## Development Workflow

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/404Suvo/INTORA.git
   cd INTORA
   npm install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   ```
   Add your `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey).

3. **Run Locally**:
   ```bash
   npm run dev
   ```

4. **Verify Tests & Build**:
   ```bash
   npm test
   npm run build
   ```

## Commit Convention

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features or tools
- `fix:` Bug fixes or validation corrections
- `perf:` Performance optimizations
- `test:` Unit or integration test additions
- `refactor:` Code improvements without behavioral changes
- `docs:` Documentation and README updates
- `ci:` Continuous integration and automation workflows

## Guidelines

- **Zero-Trust Pricing**: Never allow the agent to calculate totals or modify product prices directly. All pricing must resolve through `lib/catalog.ts`.
- **Integer Minor Units**: Always use integer paise (INR). No floats in plan models or blockchain calldata.
- **Non-Custodial Principle**: Do not implement features that hold or store user private keys on the server.
