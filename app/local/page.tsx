import Link from "next/link";
import Game from "@/components/game/Game";

export default function LocalGame() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center py-8 px-4 w-full max-w-[850px] mx-auto gap-4">
      <div className="flex items-center justify-between w-full">
        <h1 className="text-xl">Local Game</h1>
        <Link className="text-sm underline" href="/">
          Back to lobby
        </Link>
      </div>
      <Game />
    </main>
  );
}
