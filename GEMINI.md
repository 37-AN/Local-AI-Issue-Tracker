# GEMINI.md

## Project Overview

This project is a **Local AI Issue Tracker**, a web application designed for privacy-first, local-first incident operations. It's built with a modern tech stack:

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS
*   **Backend:** Next.js API Routes with Supabase for the database and authentication.
*   **AI:** The project is designed to integrate with local AI models for features like ticket analysis, root cause suggestion, and SOP (Standard Operating Procedure) generation.

The core of the application is a single-page interface (`app/page.tsx`) that provides a dashboard for managing tickets, SOPs, users, and interacting with the AI assistant. The long-term vision for the project, as detailed in `Integrate Backend Features to UI.md`, is to create a comprehensive, enterprise-grade AI-powered issue tracker that runs entirely on local infrastructure.

## Building and Running

The project uses `pnpm` as the package manager (inferred from `pnpm-lock.yaml`).

### Key Commands

*   **Run development server:**
    ```bash
    pnpm dev
    ```
    This starts the Next.js development server with Turbopack at `http://localhost:3000`.

*   **Build for production:**
    ```bash
    pnpm build
    ```

*   **Start production server:**
    ```bash
    pnpm start
    ```

*   **Linting:**
    ```bash
    pnpm lint
    ```
    Uses `oxlint`.

*   **Type Checking:**
    ```bash
    pnpm type-check
    ```
    Uses `tsc`.

*   **Run all checks:**
    ```bash
    pnpm check-all
    ```
    Runs linting and type checking in parallel.

### Supabase Local Development

The project uses Supabase for its backend. The configuration in `supabase/config.toml` indicates a local development setup. You'll likely need the [Supabase CLI](https://supabase.com/docs/guides/cli) to run the local database and other services.

*   **Start Supabase services:** (TODO: Confirm command, likely `supabase start`)
*   **Stop Supabase services:** (TODO: Confirm command, likely `supabase stop`)

## Development Conventions

*   **TypeScript:** The project is written in TypeScript and uses `strict` mode (`tsconfig.json`), which enforces strong typing. Path aliases (`@/*`) are configured to simplify imports.
*   **Styling:** Tailwind CSS is used for styling.
*   **Backend:** Backend logic is implemented in Next.js API routes (`app/api/**/route.ts`). These routes use the Supabase client for database operations.
*   **Authentication & Authorization:** The application has a role-based access control (RBAC) system with roles like `Admin`, `Engineer`, and `Viewer`. Authentication is handled via Supabase Auth.
*   **Database:** The database schema is managed with Supabase migrations (`supabase/migrations`).
*   **AI Integration:** The project is set up to use local AI models. The code in `lib/ai.ts` and `lib/rag.ts`, and the API routes in `app/api/ai/` and `app/api/rag/` are placeholders or works-in-progress for these features.
*   **UI:** The main UI is a large, single-file React component in `app/page.tsx`. It manages a significant amount of state using `useState` and `useEffect`.
*   **Observability:** The project has stubs for Prometheus metrics (`/api/metrics`) and Grafana dashboard integration.
