import { SnakeProps } from "../gameTypes";
import { cn } from "@/lib/utils";

export default function SnakeTail({ dir, color, keyProp }: SnakeProps) {
  return (
    <div
      className={`w-[clamp(20px,5vw,35px)] aspect-square border-transparent rounded-[0.25rem] flex items-center justify-center`}
      key={keyProp}
    >
      {dir == "R" ? (
        <div
          className={cn(
            color,
            "w-4/5 h-3/5",
            "w-full h-full ml-auto rounded-l-full relative"
          )}
        ></div>
      ) : dir == "D" ? (
        <div
          className={cn(
            color,
            "w-3/5 h-4/5",
            "w-full h-full mt-auto rounded-t-full relative"
          )}
        ></div>
      ) : dir == "L" ? (
        <div
          className={cn(
            color,
            "w-4/5 h-3/5",
            "w-full h-full mr-auto rounded-r-full relative"
          )}
        ></div>
      ) : (
        <div
          className={cn(
            color,
            "w-3/5 h-4/5",
            "w-full h-full mb-auto rounded-b-full relative"
          )}
        ></div>
      )}
    </div>
  );
}
