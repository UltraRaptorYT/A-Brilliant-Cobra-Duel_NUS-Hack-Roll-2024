"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Game from "@/components/game/Game";
import supabase from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import clipboardCopy from "clipboard-copy";
import { useToast } from "@/components/ui/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

type GameTypeParams = {
  params: {
    gameID: string;
  };
};

function generateRoundID() {
  // Generate a random number between 1000000000 and 9999999999 (inclusive)
  return Math.floor(Math.random() * 9000000000) + 1000000000;
}

export default function GameRoom({ params }: GameTypeParams) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<RealtimeChannel>();
  const router = useRouter();
  const [userID, setUserID] = useState<string>("");
  const [roundID, setRoundID] = useState<number>(generateRoundID());
  const gameID = params.gameID;
  const [gameStart, setGameStart] = useState<boolean>(false);
  const [accordionVal, setAccordionVal] = useState<string>("item-1");
  const [gameReady, setGameReady] = useState<boolean>(false);

  async function checkRoom(room_id: string) {
    const { data, error } = await supabase
      .from("abcd_game_user")
      .select()
      .eq("game_id", room_id);
    if (error) {
      console.log(error);
      return;
    }
    if (data.length > 2) {
      return router.push("/");
    } else if (data.length == 2) {
      setGameReady(true);
    } else {
      setGameReady(false);
    }
  }

  async function addUserRoom(room_id: string, user_id: string) {
    console.log("hi");
    const { error } = await supabase
      .from("abcd_game_user")
      .insert({ game_id: room_id, user_id: user_id });
    if (error) {
      console.log(error);
      return;
    }
  }

  async function removeUserRoom(room_id: string, user_id: string) {
    const { error } = await supabase
      .from("abcd_game_user")
      .delete()
      .eq("game_id", room_id)
      .eq("user_id", user_id);
    if (error) {
      console.log(error);
      return;
    }
  }

  useEffect(() => {
    if (gameID && userID) {
      const channel = supabase.channel(`${gameID}_room`, {
        config: {
          broadcast: {
            self: true,
          },
          presence: {
            key: userID,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const newState = channel.presenceState();
          console.log("sync", newState);
          if (Object.keys(newState).length == 2) {
          }
        })
        .on("presence", { event: "join" }, async ({ key, newPresences }) => {
          console.log("join", key, newPresences);
          await addUserRoom(gameID, key);
          await checkRoom(gameID);
        })
        .on("presence", { event: "leave" }, async ({ key, leftPresences }) => {
          console.log("leave", key, leftPresences);
          await removeUserRoom(gameID, key);
          await checkRoom(gameID);
        });

      channel.on(
        "broadcast",
        { event: "gameStart" },
        ({ payload }: { payload: { state: boolean } }) => {
          console.log(payload);
          setGameStart(payload.state);
        }
      );

      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") {
          return;
        }

        const presenceTrackStatus = await channel.track({ userID: userID });
        console.log(presenceTrackStatus);
      });
      setChannel(channel);

      return () => {
        channel.unsubscribe();
        setChannel(undefined);
      };
    }
  }, [gameID, userID]);

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

  async function postUser(uuid: string) {
    const { error } = await supabase.from("abcd_user").insert({ id: uuid });
    if (error) {
      return console.log(error);
    }
  }

  useEffect(() => {
    if (localStorage.getItem("user_id") == null) {
      const user_id = uuidv4();
      localStorage.setItem("user_id", user_id);
      postUser(user_id);
    }
    setUserID(localStorage.getItem("user_id") ?? "");
    checkGame();
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center p-8 w-full min-w-[300px] max-w-[800px] mx-auto gap-4">
      <div className="flex flex-col gap-4 items-center justify-center">
        <div className="text-xl flex gap-4 items-center justify-between">
          Room Code: <span className="font-bold">{gameID}</span>
          <Button
            size="sm"
            variant={"secondary"}
            onClick={async () => {
              await clipboardCopy(
                `${process.env.NEXT_PUBLIC_SITE_URL}/${gameID}`
              );
              toast({
                title: "Game URL Copied!",
                duration: 1000,
              });
            }}
          >
            <Share2 size={16} />
          </Button>
        </div>
        <div className="flex text-lg gap-4 items-center">
          Score:
          <div className="flex text-bold text-xl gap-1">
            <span className="font-bold">0</span>
            <span>-</span>
            <span className="font-bold">0</span>
          </div>
        </div>
      </div>

      {gameStart ? (
        <Game round_id={roundID} game_id={gameID} />
      ) : (
        <div className="flex flex-col gap-4">
          <Accordion
            type="single"
            collapsible
            className="min-w-[300px] w-screen max-w-[600px] px-4"
            value={accordionVal}
            onValueChange={setAccordionVal}
          >
            <AccordionItem value="item-1" className="rounded-lg border-2">
              <AccordionTrigger
                className={cn(
                  accordionVal ? "border-b" : "",
                  "px-4 no-underline hover:no-underline"
                )}
              >
                How To Play
              </AccordionTrigger>
              <AccordionContent className="py-4 px-4">
                Yes. It adheres to the WAI-ARIA design pattern.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {gameReady ? (
            <div>Game Ready</div>
          ) : (
            <div>Waiting for other player...</div>
          )}
        </div>
      )}
    </main>
  );
}
