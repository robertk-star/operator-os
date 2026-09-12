# OperatorOS

Reusable operating system for solo operators and small teams.

OperatorOS is a clean public template extracted from the private RobertOS system. It is not a Saffhire product and it is not limited to background screening or any other industry.

A workspace can be one person or a small team. Each install names itself. Industry workflows are optional packs, not core code.

## What this is

A portable command layer for running work:

- Tasks
- Notes
- Email and calendar
- Contacts
- Relationships
- Revenue engine
- Settings
- Admin

RobertOS remains the private production system. This repo is the reusable template others can fork.

## Who it is for

- A solo operator who needs one place for work, people, and follow-through
- A small team that needs shared tasks, contacts, and revenue motion without enterprise bloat
- A later industry pack (legal, home services, screening, and so on) installed on the same core

## Day-one modules

| Module | Purpose |
| --- | --- |
| Tasks | Capture, schedule, complete, and review work |
| Notes | Durable writing that can link to people, tasks, and deals |
| Email | Inbox triage and send from the same operator loop |
| Calendar | Time as a first-class object, not a sidecar |
| Contacts | People records with workspace ownership |
| Relationships | Ongoing context around people and accounts, not a flat list |
| Revenue engine | Find, score, work, and follow opportunities |
| Settings | Workspace identity, integrations, and preferences |
| Admin | Users, roles, branding, and workspace control |

See [docs/CONSTITUTION.md](docs/CONSTITUTION.md) and [docs/MODULES.md](docs/MODULES.md).

## Product rules

1. Core has no industry story baked in.
2. A new install works after naming the workspace and choosing solo or team mode.
3. Packs add capability. They do not rewrite the core.
4. Patches become permanent fixes. Code stays editable.
5. Public copy uses plain punctuation. No em dashes.

## Status

Phase 0: constitution and module map.
Phase 1: app scaffold and first-run setup.
Phase 2: port day-one modules from RobertOS with industry assumptions removed.
Phase 3: optional packs and publish checklist.

## License

MIT. See [LICENSE](LICENSE).
