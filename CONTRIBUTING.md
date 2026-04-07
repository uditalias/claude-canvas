# Contributing to claude-canvas

Thanks for your interest in contributing! Whether it's a bug fix, new feature, or documentation improvement — all contributions are welcome.

## Getting Started

### Prerequisites

- **Node.js** >= 18
- A modern browser (Chrome, Firefox, Safari, Edge)

### Setup

```bash
git clone https://github.com/uditalias/claude-canvas.git
cd claude-canvas
npm install
```

### Development

```bash
# Full stack dev (server with hot reload)
npm run dev

# Client only (Vite dev server on :5173, proxies API/WS to :7890)
npm run dev:client

# Build everything
npm run build

# Build client or server separately
npm run build:client
npm run build:server
```

### Running Tests

```bash
# Unit tests
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests (requires build first)
npm run build && npm run test:e2e

# All tests
npm test && npm run test:e2e
```

## Project Structure

```
src/
├── bin/                  # CLI entry point + subcommands
│   ├── actions/          # CLI subcommand handlers (ask, draw, start, stop, etc.)
│   └── dsl/              # DSL compiler (tokenizer → parser → layout)
├── server/               # Express + WebSocket server
├── client/               # React + Fabric.js + Tailwind CSS 4 frontend
│   ├── components/       # UI components (Canvas, Toolbox, QuestionPanel, etc.)
│   ├── hooks/            # React hooks (canvas, drawing tools, WebSocket, etc.)
│   └── lib/              # Rendering engine, rough.js utilities
├── protocol/             # Shared types between server and client
├── skill/                # Claude Code skill (SKILL.md + DSL-REFERENCE.md)
└── utils/                # Shared utilities (browser, port, screenshot)
```

See the [Architecture section](README.md#architecture) in the README for more details.

## How to Contribute

### Reporting Bugs

Open an [issue](https://github.com/uditalias/claude-canvas/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
- Browser (if relevant)

### Submitting Changes

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
3. Make your changes
4. Run tests to make sure nothing is broken:
   ```bash
   npm test
   ```
5. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: add my feature"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/my-feature
   ```
7. Open a [Pull Request](https://github.com/uditalias/claude-canvas/pulls) against `main`

### Commit Messages

Use clear, descriptive commit messages. We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `refactor:` — code restructuring without behavior change
- `test:` — adding or updating tests
- `chore:` — build, tooling, or dependency updates

### Code Style

- TypeScript throughout — no `any` unless truly necessary
- React functional components with hooks
- Path alias `@` maps to `src/client/` (configured in `vite.config.ts`)
- Tailwind CSS 4 for styling, shadcn/ui (Radix) for UI primitives

### Key Conventions

- **Layer system**: objects have `data.layer` set to `"user"` (drawn interactively) or `"claude"` (drawn via API)
- **DSL format**: the compact drawing language in `src/bin/dsl/` — changes here need corresponding updates to `src/skill/claude-canvas/DSL-REFERENCE.md`
- **Skill files**: `src/skill/claude-canvas/SKILL.md` and `DSL-REFERENCE.md` are what Claude reads to learn the tool — keep them accurate and concise
- **Protocol types**: shared types live in `src/protocol/types.ts` — changes here affect both server and client

## Questions?

Open an [issue](https://github.com/uditalias/claude-canvas/issues) or start a [discussion](https://github.com/uditalias/claude-canvas/discussions).
