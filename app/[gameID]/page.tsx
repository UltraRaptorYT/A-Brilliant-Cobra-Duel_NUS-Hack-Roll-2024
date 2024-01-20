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
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const [accordionVal, setAccordionVal] = useState<string>("");
  const [gameReady, setGameReady] = useState<boolean>(false);
  const [historyPrompt, setHistoryPrompt] = useState<string[]>([
    "testing1",
    "testing2",
    "testing3",
    "testing4",
    "testing5",
  ]);
  const [historyData, setHistoryData] = useState<string[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const fixedPromptAdd: string[] = ["emojis_board", "chars_board"];
  const instruction = `# Instructions:

-This is a 1vs1 snake game where two LLM Agents are playing against each other. You can either modify the model and/or the prompt for each Agent.
-The following variables are available for the prompt, updated at each turn, in order to make the agent aware of the current situation: {emojis_board}, {chars_board}, {board_state_str}. 

-It's not necessary to use all of them, it would take longer and spend more tokens

### Example {emojis_board} (690 tokens):
00⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
01⬜⬜⬜⬜⬜⬜⬜⬜🍎⬜⬜⬜⬜⬜⬜
02⬜⬜🟩🟩🟩🟢⬜⬜⬜⬜⬜⬜⬜⬜⬜
03⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
04⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
05⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
06⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
07⬜⬜⬜⬜⬜⬜⬜🍎⬜⬜⬜⬜⬜⬜⬜
08⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
09⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
10⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
11⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
12⬜⬜⬜⬜⬜⬜⬜⬜⬜🔵🟦🟦🟦⬜⬜
13⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
14⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜

—

### Example {chars_board} (240 tokens):
00 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
01 _ _ _ _ _ _ _ _ R _ _ _ _ _ _
02 _ _ g g g G _ _ _ _ _ _ _ _ _
03 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
04 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
05 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
06 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
07 _ _ _ _ _ _ _ R _ _ _ _ _ _ _
08 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
09 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
10 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
11 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
12 _ _ _ _ _ _ _ _ _ B b b b _ _
13 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
14 _ _ _ _ _ _ _ _ _ _ _ _ _ _ _

### Example {board_state_str} (100-120 tokens):

{
    "turn": 0,
    "snake1": {
        "body": [(5, 2), (4, 2), (3, 2), (2, 2)],
        "dir": "R",
        "is_alive": True,
    },
    "snake2": {
        "body": [(9, 12), (10, 12), (11, 12), (12, 12)],
        "dir": "L",
        "is_alive": True,
    },
    "food": [(7, 7), (8, 1)],
}

## More Details Default prompt

You will find a couple of default prompt examples that you can modify.
The agent has always to output one (and only one) of the following emojis: U,D,L,R to chose the direction of the next move.
The agent can make a few lines (recommended 1-3) of reasoning before deciding the next move.
The game ends when one of the snakes dies by hitting a wall or another snake or after 100 turns.
The game is played in a 15x15 grid board. x is the horizontal axis and goes from 0 to 14 left to right. y is the vertical axis and goes from 0 to 14 up to down.`;

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
    if (localStorage.getItem("instruction") == null) {
      localStorage.setItem("instruction", "item-1");
    }
    setAccordionVal(localStorage.getItem("instruction") ?? "");
    checkGame();
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center py-8 px-4 w-full min-w-[300px] max-w-[800px] mx-auto gap-4">
      <div className="flex flex-col gap-4 items-center justify-center">
        <div className="text-xl flex gap-4 items-center justify-between">
          Game Code: <span className="font-bold">{gameID}</span>
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
        <div className="flex flex-col gap-8 w-full">
          <Accordion
            type="single"
            collapsible
            className="min-w-[300px] w-full max-w-[800px]"
            value={accordionVal}
            onValueChange={(val) => {
              setAccordionVal(val);
              localStorage.setItem("instruction", val);
            }}
          >
            <AccordionItem value="item-1" className="rounded-lg border-2">
              <AccordionTrigger
                className={cn(
                  accordionVal ? "border-b" : "",
                  "px-4 no-underline hover:no-underline"
                )}
              >
                Instructions
              </AccordionTrigger>
              <AccordionContent className="py-4 px-4">
                <Markdown>{instruction}</Markdown>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {gameReady ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 md:gap-x-3 h-full">
              <div className="col-span-3 grid grid-cols-4 order-1 md:order-0 gap-2 h-full min-h-[200px] max-h-[300px]">
                <Textarea
                  placeholder="Type your message here."
                  rows={10}
                  className="col-span-3"
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                />
                <div className="flex flex-col gap-2 h-full min-h-[200px] max-h-[300px]">
                  {fixedPromptAdd.map((val, idx) => {
                    return (
                      <Button
                        key={`fixedPromptAdd_${idx}`}
                        variant={"secondary"}
                        size={"sm"}
                        className="text-xs w-full overflow-hidden"
                        onClick={() => {
                          let addValue = `{${val}} `;
                          setCurrentPrompt((prevState) => {
                            if (prevState.endsWith(" ")) {
                              return prevState + addValue;
                            }
                            return prevState + " " + addValue;
                          });
                        }}
                      >
                        {val}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col order-0 md:order-1 gap-2 h-full min-h-[200px] max-h-[300px]">
                <h1 className="text-start md:text-center font-semibold underline">
                  History
                </h1>
                <div className="flex overflow-auto md:flex-col gap-3 w-full h-full">
                  {historyPrompt.map((val, idx) => {
                    return (
                      <Card
                        key={`historyPrompt_${idx}`}
                        onClick={() => setCurrentPrompt(val)}
                        className="md:w-full min-w-[150px]"
                      >
                        <CardContent className="p-4">
                          <p className="text-sm">{val}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xl text-center py-10">
              Waiting for other player...
            </div>
          )}
        </div>
      )}
    </main>
  );
}
