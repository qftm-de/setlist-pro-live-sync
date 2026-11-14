import { appName, betriebsmodus } from "./app-info";

export function App() {
  const modus = betriebsmodus(import.meta.env.VITE_COMMUNITY_URL as string | undefined);
  return (
    <main>
      <h1>{appName}</h1>
      <p>Betriebsmodus: {modus}</p>
    </main>
  );
}
