# OperatorOS Constitution

This file is the source of product law for the reusable OS. Code follows this document. Industry examples do not.

## Purpose

Give any operator or small team one system for work, people, time, and revenue.

The system must still make sense if the user is a freelancer, a home-service owner, a founder, or a three-person shop. It must not assume background screening, Saffhire, court work, or any other vertical.

## Users

- Solo mode: one owner, no seat management required to start
- Team mode: owner plus members, roles, and shared records

Both modes share the same data model. Team mode turns on membership and permissions.

## Core promises

1. One workspace is the unit of install.
2. The workspace has a name, timezone, and owner. It does not have an industry by default.
3. Day-one modules are always present: Tasks, Notes, Email, Calendar, Contacts, Relationships, Revenue, Settings, Admin.
4. Optional packs may add modules. Packs cannot rename or hide core modules.
5. A person, a task, a note, an event, a message, and an opportunity can link to each other.
6. AI assists inside the loop. It does not replace the record.
7. Public and in-app copy is industry-neutral unless a pack is enabled.

## First-run setup

On first launch the installer asks only for:

- Workspace name
- Solo or team
- Owner name and email
- Timezone
- Which integrations to connect later (email, calendar)

It does not ask for industry, company type, or screening credentials.

## Language rules

- Call the product OperatorOS in this repo.
- Let a workspace display its own name in the shell.
- Do not mention Saffhire, RobertOS, or background screening in default UI copy.
- Do not use em dashes in user-facing copy.

## Quality rules

- Prefer a complete thin module over a decorative screen.
- A patch that is still needed next week becomes a permanent fix.
- Keep code easy to edit. Avoid hidden magic and one-off forks.
- Build in phases. Do not drag private RobertOS vertical code into this repo unchanged.

## What core must never do

- Require an industry pack to create a task or contact
- Treat revenue as only inbound lead gen for one vertical
- Hard-code scripture, court analysis, or screening forms into default briefing
- Assume Google Workspace is the only email provider forever, even if Gmail is first

## Relationship to RobertOS

RobertOS is the private origin system. Features proven there can be ported here after industry assumptions are removed. This repo is the public template. It is not a mirror of the private app.
