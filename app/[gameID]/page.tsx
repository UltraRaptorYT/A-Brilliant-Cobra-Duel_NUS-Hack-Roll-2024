"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Game from "@/components/game/Game";
import supabase from "@/lib/supabase";

type RoomTypeParams = {
  params: {
    gameID: string;
  };
};

function generateRoundID() {
  // Generate a random number between 1000000000 and 9999999999 (inclusive)
  return Math.floor(Math.random() * 9000000000) + 1000000000;
}

export default function Room({ params }: RoomTypeParams) {
  const router = useRouter();
  const [userID, setUserID] = useState<string>("");
  const [roundID, setRoundID] = useState<number>(generateRoundID());
  const gameID = params.gameID;

  async function addUser() {
    const { error } = await supabase
      .from("abcd_user_game")
      .insert({ game_id: gameID, userID: userID });
    if (error) {
      console.log(error);
      return;
    }
  }

  async function checkRound() {
    const error = true;
    do {
      const { data, error } = await supabase
        .from("abcd_round")
        .select()
        .eq("game_id", gameID)
        .eq("round_id", roundID);
      if (error) {
        console.log(error);
        setRoundID(generateRoundID());
      }
    } while (error);
  }

  async function checkGame() {
    const { data, error } = await supabase
      .from("abcd_game")
      .select()
      .eq("id", gameID);
    if (error) {
      console.log(error);
      return;
    }
    if (data.length == 0) {
      const { error } = await supabase.from("abcd_game").insert({ id: gameID });
      if (error) {
        console.log(error);
        return;
      }
    }
    checkRound();
  }

  useEffect(() => {
    if (localStorage.getItem("user_id") == null) {
      return router.push("/");
    }
    setUserID(localStorage.getItem("user_id") ?? "");
    checkGame();
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center p-8">
      {gameID},{userID}
      <Game round_id={roundID} game_id={gameID} />
    </main>
  );
}
