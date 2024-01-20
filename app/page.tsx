"use client";

import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import Game from "@/components/game/Game";
import { v4 as uuidv4 } from "uuid";
import { useEffect } from "react";
import axios from "axios";

const BASE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL || window.location.hostname;

export default function Home() {
  async function postUser(uuid: string) {
    const response = await axios.post(BASE_URL + "/api/user", {
      user_id: uuid,
    });
    console.log(response);
  }

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      if (!localStorage.getItem("user_id")) {
        const user_id = uuidv4();
        localStorage.setItem("user_id", user_id);
        postUser(user_id);
      }
    }
  });

  return (
    <main className="flex min-h-[100dvh] flex-col items-center">
      <ThemeToggle></ThemeToggle>
      <Game />
    </main>
  );
}
