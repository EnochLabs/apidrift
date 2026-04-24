# Contributing to apidrift

Welcome to the `apidrift` project! We appreciate your interest in contributing. This document outlines the architecture, the schema storage format, and the development workflow to help you get started.

## Architecture Overview

`apidrift` is designed as a lightweight, zero-dependency API drift detection tool. It operates by observing API responses, extracting their structural "shape" (schema), and comparing these shapes over time to detect breaking and non-breaking changes.

The core architecture consists of the following modules:

1.  **Schema Extractor (`src/core/schema.ts`)**:
    This module takes a raw JSON response and recursively extracts its structural shape into a `SchemaNode` tree. It discards actual data values, ensuring privacy and keeping the storage footprint minimal. It handles primitives, nested objects, arrays (by merging item schemas), and edge cases like circular references and non-object roots.

2.  **Diff Engine (`src/core/diff.ts`)**:
    The diff engine compares two `Schema` objects (a baseline and a new schema) to identify structural differences. It detects added fields, removed fields, and type changes. It classifies changes as either `BREAKING` (e.g., field removal, type change) or `NON_BREAKING` (e.g., new optional field added).

3.  **Storage Layer (`src/core/storage.ts`, `src/core/history.ts`, `src/core/datadrift-storage.ts`)**:
    This layer manages the persistence of schemas, historical versions, and data drift statistics. All data is stored locally in the `.apidrift/` directory within the user's project.

4.  **Tracker & Interceptors (`src/core/tracker.ts`, `src/interceptors/fetch.ts`)**:
    The tracker is the entry point for observing API calls. The fetch interceptor automatically hooks into `globalThis.fetch` (or a custom target) to passively monitor responses and feed them to the tracker without blocking the application.

5.  **CLI (`src/cli/index.ts`)**:
    The command-line interface provides tools for developers to interact with the stored data. It includes commands for diffing, watching live endpoints, viewing history, exporting schemas, and generating TypeScript types.

## Schema Storage Format

`apidrift` stores its data in the `.apidrift/` directory at the root of the user's project. The primary files are:

*   `snapshots.json`: Stores the latest baseline schema for each tracked endpoint.
*   `history.json`: Stores a timeline of schema versions and the specific changes between them.
*   `datadrift.json`: Stores statistical baselines for numeric fields to detect data anomalies (spikes/drops).
*   `apidrift.contract.json`: Stores locked schemas that enforce strict compliance in CI environments.

### The `SchemaNode` Structure

The core data structure is the `SchemaNode`, which represents the type of a specific field.

```typescript
export type SchemaType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "array"
  | "object"
  | "unknown";

export interface SchemaNode {
  type: SchemaType;
  optional?: boolean;
  children?: Record<string, SchemaNode>; // Present if type is "object"
  items?: SchemaNode;                    // Present if type is "array"
  nullable?: boolean;
}
```

A full `Schema` is simply a record of top-level fields mapped to their `SchemaNode` definitions:

```typescript
export type Schema = Record<string, SchemaNode>;
```

*Note: If an API returns a non-object root (e.g., a raw array or string), `apidrift` wraps it in a special `_root` field to maintain a consistent `Record<string, SchemaNode>` structure.*

### Example: `snapshots.json`

This file contains the latest observed schema for each endpoint.

```json
{
  "version": "1.0",
  "snapshots": {
    "https://api.example.com/users": {
      "endpoint": "https://api.example.com/users",
      "schema": {
        "id": { "type": "number" },
        "name": { "type": "string" },
        "email": { "type": "string", "optional": true },
        "roles": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "capturedAt": "2023-10-27T10:00:00.000Z",
      "responseCount": 42
    }
  }
}
```

### Example: `history.json`

This file tracks the evolution of an endpoint's schema over time.

```json
{
  "version": "1.0",
  "history": {
    "https://api.example.com/users": {
      "endpoint": "https://api.example.com/users",
      "entries": [
        {
          "timestamp": "2023-10-26T09:00:00.000Z",
          "schema": { /* v1 schema */ },
          "changes": [],
          "responseCount": 10,
          "checksum": "a1b2c3d4"
        },
        {
          "timestamp": "2023-10-27T10:00:00.000Z",
          "schema": { /* v2 schema */ },
          "changes": [
            {
              "path": "email",
              "kind": "FIELD_ADDED",
              "impact": "NON_BREAKING",
              "description": "Field 'email' was added"
            }
          ],
          "responseCount": 32,
          "checksum": "e5f6g7h8"
        }
      ]
    }
  }
}
```

## Development Workflow

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/EnochLabs/apidrift.git
    cd apidrift
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Build the project**:
    The project is written in TypeScript. Compile it using:
    ```bash
    npm run build
    ```

4.  **Run tests**:
    We use a custom, zero-dependency test runner (`test.mjs`) to ensure the core engine remains lightweight.
    ```bash
    node test.mjs
    ```
    Ensure all tests pass before submitting a pull request. If you add new features, please add corresponding tests to `test.mjs`.

5.  **Code Style**:
    Please adhere to the existing code style. We prioritize readability, minimal dependencies, and robust error handling (the tracker should *never* crash the host application).

## Submitting Changes

1.  Create a new branch for your feature or bugfix.
2.  Make your changes, ensuring you update tests and documentation as necessary.
3.  Run `npm run build` and `node test.mjs` to verify everything works.
4.  Submit a Pull Request with a clear description of the changes and the problem they solve.

Thank you for contributing to `apidrift`!
