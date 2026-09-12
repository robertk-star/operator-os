# OperatorOS Module Map

## Day-one core

| Module | RobertOS origin | Port rule |
| --- | --- | --- |
| Tasks | assignments, action-center, priorities | Generic work items with due time, owner, status, links |
| Notes | notes, documents, obsidian-notes | Workspace notes first. Vault sync is a later pack |
| Email | email | Provider-neutral records. Gmail connector first |
| Calendar | calendar | Events with attendees and task links |
| Contacts | contacts | People and organizations. No vertical required fields |
| Relationships | contacts plus graph/links | Timeline of interactions around a person or account |
| Revenue engine | revenue-engine, prospects, outbound-sequences | Generic pipeline: find, qualify, work, follow up |
| Settings | settings, ai-settings | Workspace identity, integrations, AI keys |
| Admin | admin/workspace | Users, roles, branding, workspace lifecycle |

## Later core candidates

Not required on day one, but belong in core after the first nine are real:

- Command Center / Chief of Staff briefing
- Knowledge search
- Procedures
- Goals
- Specialists

## Optional packs

Keep these out of default install:

- Court analysis
- Screening / background workflows
- Scripture or faith briefing
- Obsidian vault sync
- Custom GPT connector
- Industry SOP libraries

## Data objects

Minimum shared objects every core module can point at:

- Workspace
- User
- Task
- Note
- Contact
- Organization
- RelationshipEvent
- CalendarEvent
- Message
- Opportunity
- Integration

## Solo vs team

| Concern | Solo | Team |
| --- | --- | --- |
| Owner | Required | Required |
| Extra members | Hidden | Invite and roles |
| Record owner | Defaults to the only user | Assignable |
| Admin | Same person as operator | Separate admin screens stay visible |
| Revenue | Personal pipeline | Shared pipeline with owner field |

## Port order

1. Workspace, auth, settings, admin shell
2. Tasks and notes
3. Contacts and relationships
4. Calendar and email connectors
5. Revenue engine with generic stages
6. First-run installer polish
