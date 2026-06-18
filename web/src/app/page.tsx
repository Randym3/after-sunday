type ApiHealthResponse = {
  status: string;
};

async function getApiHealth(): Promise<ApiHealthResponse | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const apiHealth = await getApiHealth();
  console.log("API Health:", apiHealth);
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
          After Sunday
        </p>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Sermon follow-up for the people who missed Sunday.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Turn a sermon transcript into a simple, reviewed follow-up email with
          a summary, reflection questions, and a prayer prompt.
        </p>

        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 px-5 py-4 text-sm">
          <span className="text-slate-400">API status: </span>
          <span className={apiHealth ? "text-green-400" : "text-red-400"}>
            {apiHealth ? apiHealth.status : "offline"}
          </span>
        </div>
      </section>
    </main>
  );
}