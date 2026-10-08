import { SnakeProps } from "../gameTypes";
import { cn } from "@/lib/utils";

export default function SnakeBody({
  color,
  keyProp,
  corner,
}: SnakeProps & { corner?: string }) {
  return (
    <div
      className={`w-full h-full border-transparent rounded-[0.25rem] flex items-center justify-center`}
      key={keyProp}
    >
      <div className={cn(color, "w-full h-full relative", corner)}></div>
    </div>
  );
}
