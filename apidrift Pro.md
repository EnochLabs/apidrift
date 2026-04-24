# apidrift Pro: Strategic Roadmap for Extraordinary Features

This roadmap outlines key enhancements designed to elevate `apidrift` into an indispensable tool for developers at leading technology companies. The focus is on delivering high-impact features that are feasible to implement within the existing architecture, require no external APIs or costs, and significantly improve the developer experience through **Zero-Friction Governance**, **Intelligent Inference**, and **Visual Storytelling**.

## 1. Zero-Config CI/CD Integration (`apidrift ci-gen`)

### Value Proposition

Developers at companies like Google, Amazon, and Microsoft operate within robust CI/CD pipelines. Manual configuration of these pipelines for API contract validation is a tedious and error-prone process. The `apidrift ci-gen` command will eliminate this friction by automatically generating a ready-to-use CI workflow file (e.g., GitHub Actions `.yml`) that integrates `apidrift check` into the pull request lifecycle. This ensures that any breaking API changes are caught *before* they are merged, enforcing API contracts as a first-class citizen of the development process.

### Technical Feasibility

This feature is highly feasible. It primarily involves:

*   **Environment Detection**: Identifying the CI/CD environment (e.g., presence of `.github/workflows` for GitHub Actions).
*   **Template Generation**: Using predefined templates for popular CI/CD platforms to generate the appropriate `.yml` file.
*   **Configuration**: Injecting `apidrift check` commands and exit codes to fail builds on detected breaking changes.

### High-Level Plan

1.  Create a new CLI command `ci-gen`.
2.  Implement logic to detect common CI environments.
3.  Develop templates for GitHub Actions (initially) that include:
    *   Installation of `apidrift`.
    *   Execution of `apidrift check` against a baseline (e.g., a snapshot from the `main` branch).
    *   Configuration to fail the build if `apidrift check` reports breaking changes.
4.  Provide options for users to customize the generated workflow (e.g., target branch for baseline).

## 2. Smart Schema Inference (Enum & Pattern Detection)

### Value Proposition

The current `apidrift` schema extractor identifies basic types (string, number, boolean, object, array). While functional, this can be enhanced to provide richer, more meaningful schema definitions. Automatically detecting enums (e.g., `"status": "active" | "inactive" | "pending"`) and common string patterns (e.g., UUIDs, ISO-8601 dates, email addresses) would make the generated schemas significantly more descriptive and useful. This intelligent inference reduces the cognitive load on developers, allowing them to quickly understand API contracts and spot subtle changes that might otherwise be missed.

### Technical Feasibility

This feature is highly feasible and can be integrated directly into the existing `extractSchema` logic:

*   **Enum Detection**: For string fields, collect a set of unique values. If the set size is small and consistent across samples, infer an enum type.
*   **Pattern Matching**: Implement regular expression-based checks for common patterns (e.g., UUID regex, ISO date regex, email regex) on string fields.
*   **Confidence Scoring**: Assign a confidence score to inferred types to avoid false positives, allowing for manual override if needed.

### High-Level Plan

1.  Modify `src/core/schema.ts` to enhance `extractSchema`.
2.  Introduce new `SchemaType` variants or properties for `enum` and `pattern`.
3.  Implement logic to collect string values and analyze them for enum candidates.
4.  Implement regex-based pattern detection for strings.
5.  Adjust the `diff` engine to recognize and report changes in enum values or patterns.

## 3. Local Drift Dashboard (Static HTML Report)

### Value Proposition

While the CLI provides powerful insights, a visual representation of API drift can significantly enhance understanding and collaboration. This feature will generate a self-contained, interactive HTML report that developers can open in any browser. This report will visualize the API's evolution over time, highlight breaking changes, and provide an intuitive interface to explore historical schemas and their differences. Being a single static HTML file, it requires no server, no deployment, and can be easily shared or archived, making it ideal for local development, code reviews, and post-mortems.

### Technical Feasibility

This feature is feasible using existing web technologies:

*   **Data Export**: The `apidrift export` command already provides JSON output. This can be extended to include historical data.
*   **HTML Templating**: Use a simple JavaScript-based templating engine or direct string concatenation to embed the exported data into an HTML file.
*   **Visualization**: Leverage lightweight JavaScript libraries (e.g., Chart.js for timelines, simple DOM manipulation for interactive diffs) and a utility-first CSS framework (e.g., Tailwind CSS via CDN) to create an appealing and functional interface.

### High-Level Plan

1.  Create a new CLI command `report` with an `--html` flag.
2.  Develop a new `src/core/reporter.ts` module to aggregate all relevant data (snapshots, history, stats).
3.  Create an HTML template file (`report.html.template`) that includes:
    *   Embedded JSON data from the reporter.
    *   Minimal CSS (e.g., Tailwind CDN) for styling.
    *   JavaScript for rendering interactive charts and schema diffs.
4.  Implement logic in the `report` command to populate the template and write the final HTML file to disk.

This roadmap focuses on delivering tangible value through intelligent automation and enhanced visualization, making `apidrift` an indispensable tool for maintaining API quality and accelerating development cycles in demanding environments. These features are designed to be zero-cost and built upon the existing robust foundation, ensuring rapid development and immediate impact.
