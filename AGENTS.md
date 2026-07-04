# Project Frontstage Rules

This project publishes customer-facing dashboards and public registration views. Treat every public page, dashboard, visual, report, and exported customer-facing artifact as frontstage.

- Before planning or implementing any visual, presentation, website, app, dashboard, brand, design-system, or customer-facing deliverable, clarify audience, deliverable format, visual direction, design system, typography, content boundaries, and customer-facing tone.
- Never show backend, technical, channel, collection, prompt, tool, implementation, QA, script, or process language in frontstage outputs unless the user explicitly asks for it.
- Public registration product views may show verified business facts only: product name, registration certificate number, registrant, domestic agent name and address, approval date, expiry date, model/specification, components, approved scope or indication, regulatory class, origin, and verification status.
- Keep collection and evidence fields backend-only. This includes source account, source title, source URL, evidence text, source dataset, confidence, crawler notes, data pipeline notes, internal status labels, and any article or channel references.
- Import products that have an NMPA domestic agent or agency registration entity must store and display `agent_name` and `agent_address` when available.
- Publishing or dashboard build scripts must strip backend-only collection fields from public assets and must not render them in the interface.
