import ScottishHousingDashboard from "./components/scottishHousingDashboard";

export default function Home() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Scottish Housing Statistics</h1>
      <ScottishHousingDashboard />
    </main>
  );
}
