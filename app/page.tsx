const modules = [
  "Tasks",
  "Notes",
  "Email",
  "Calendar",
  "Contacts",
  "Relationships",
  "Revenue",
  "Settings",
  "Admin",
];

export default function HomePage() {
  return (
    <main className="wrap">
      <p className="kicker">Public template</p>
      <h1>OperatorOS</h1>
      <p>
        A reusable operating system for solo operators and small teams.
        Industry workflows are optional packs. Core stays generic.
      </p>
      <p>Day-one modules</p>
      <ul className="modules">
        {modules.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </main>
  );
}
