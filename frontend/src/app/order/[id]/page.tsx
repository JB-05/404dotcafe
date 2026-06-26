export default async function OrderTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="paper-card p-8 w-full max-w-md text-center">
        <h1 className="font-[family-name:var(--font-special)] text-xl">ORDER TRACKING</h1>
        <p className="mt-4 text-2xl font-semibold">{id}</p>
        <p className="mt-2 text-sm opacity-70">Live tracking — Step 8</p>
      </div>
    </div>
  );
}
