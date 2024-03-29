"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { v4 as uuidv4 } from "uuid";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "next-themes";
import { Clipboard } from "lucide-react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";

const BASE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL || window.location.hostname;

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { theme } = useTheme();
  const [logoImage, setLogoImage] = useState<string>("/ABCD-dark.png");
  async function postUser(uuid: string) {
    const { error } = await supabase.from("abcd_user").insert({ id: uuid });
    if (error) {
      return console.log(error);
    }
  }
  const [inputVal, setInputVal] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      if (!localStorage.getItem("user_id")) {
        const user_id = uuidv4();
        localStorage.setItem("user_id", user_id);
        postUser(user_id);
      }
    }
  }, []);

  useEffect(() => {
    setLogoImage(theme == "dark" ? "/ABCD-dark.png" : "/ABCD-light.png");
  }, [theme]);

  async function joinGame() {
    if (!inputRef.current) {
      return;
    }
    let gameID: string = inputRef.current.value;
    if (gameID.trim().length == 0) {
      toast({
        title: "Invalid Game Code",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }
    if (gameID.includes(process.env.NEXT_PUBLIC_SITE_URL ?? "")) {
      gameID = gameID.replace(process.env.NEXT_PUBLIC_SITE_URL + "/" ?? "", "");
    }
    const { data, error } = await supabase
      .from("abcd_game_user")
      .select()
      .eq("game_id", gameID);
    if (error) {
      return console.log(error);
    }
    if (data.length >= 2) {
      toast({
        title: "Game Room Full",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }
    return router.push(`/${gameID}`);
  }

  async function pasteText() {
    let pasteText = await navigator.clipboard.readText();
    setInputVal(pasteText);
  }

  return (
    <main className="flex min-h-[100dvh] max-w-[300px] mx-auto min-w-[300px] flex-col items-center justify-center p-4">
      <Image src={logoImage} alt="" width={300} height={300} priority={true} />
      <div className="flex justify-center items-center w-full flex-col gap-4">
        <div className="flex items-center">
          <Input
            type="text"
            placeholder="Game Code"
            ref={inputRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <Button variant={"ghost"} size={"sm"} onClick={() => pasteText()}>
            <Clipboard size={20} />
          </Button>
        </div>
        <Button variant={"secondary"} onClick={joinGame}>
          Join Game
        </Button>
      </div>
    </main>
  );
}
