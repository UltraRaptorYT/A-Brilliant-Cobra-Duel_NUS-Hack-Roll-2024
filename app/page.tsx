"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function join() {
    let room = code.trim();
    try {
      if (room.includes("://"))
        room = new URL(room).pathname.split("/").filter(Boolean).pop() || "";
    } catch {
      setError("Enter a valid game code or invite link.");
      return;
    }
    if (
      !/^[a-zA-Z0-9-]{1,64}$/.test(room) ||
      room === "local" ||
      room === "api"
    ) {
      setError("Enter a valid game code.");
      return;
    }
    router.push("/" + room);
  }
  return (
    <main className="flex min-h-[100dvh] max-w-[300px] mx-auto min-w-[300px] flex-col items-center justify-center p-4">
      <Image
        src={resolvedTheme === "light" ? "/ABCD-light.png" : "/ABCD-dark.png"}
        alt="A Brilliant Cobra Duel"
        width={300}
        height={300}
        priority
      />
      <div className="flex justify-center items-center w-full flex-col gap-4">
        <div className="flex items-center">
          <Input
            aria-label="Game Code"
            placeholder="Game Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") join();
            }}
          />
          <Button
            aria-label="Paste game code"
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                setCode(await navigator.clipboard.readText());
              } catch {
                setError("Paste the game code into the field.");
              }
            }}
          >
            <Clipboard size={20} />
          </Button>
        </div>
        <Button variant="secondary" onClick={join}>
          Join Game
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/" + crypto.randomUUID().slice(0, 8))}
        >
          Create Game
        </Button>
        <Link className="text-sm underline" href="/local">
          Play locally
        </Link>
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
