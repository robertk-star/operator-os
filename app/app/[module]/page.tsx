export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const title = module.replace(/-/g, " ");
  return (
    <section className="main">
      <p className="kicker">{title}</p>
      <h2>{title}</h2>
      <p className="meta">This RobertOS module is on the OperatorOS map. The full workspace screen ports next.</p>
    </section>
  );
}
