import Link from "next/link";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const title = module.replace(/-/g, " ");

  return (
    <main className="wrap">
      <p className="kicker">
        <Link href="/app">Back</Link>
      </p>
      <h1>{title}</h1>
      <p>Shell is in place. Records for this module come next.</p>
    </main>
  );
}
