import { SnakeProps } from "../gameTypes";
import { cn } from "@/lib/utils";

export default function SnakeBody({ color, keyProp }: SnakeProps) {
  return (
    <div
      className={`w-[clamp(20px,5vw,35px)] aspect-square border-transparent rounded-[0.25rem] flex items-center justify-center`}
      key={keyProp}
    >
      <div className={cn(color, "w-full h-full relative")}></div>
    </div>
  );
}
