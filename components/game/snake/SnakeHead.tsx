import { SnakeProps } from "../gameTypes";
import { cn } from "@/lib/utils";

export default function SnakeHead({ dir, color, keyProp }: SnakeProps) {
  return (
    <div
      className={`w-[clamp(20px,5vw,35px)] aspect-square border-transparent rounded-[0.25rem] flex items-center justify-center`}
      key={keyProp}
    >
      {dir == "L" ? (
        <div
          className={cn(
            color,
            "w-4/5 h-3/5",
            "w-full h-full ml-auto rounded-l-full relative"
          )}
        >
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square top-3/4 left-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square bottom-3/4 left-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
        </div>
      ) : dir == "U" ? (
        <div
          className={cn(
            color,
            "w-3/5 h-4/5",
            "w-full h-full mt-auto rounded-t-full relative"
          )}
        >
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square left-3/4 top-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square right-3/4 top-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
        </div>
      ) : dir == "R" ? (
        <div
          className={cn(
            color,
            "w-4/5 h-3/5",
            "w-full h-full mr-auto rounded-r-full relative"
          )}
        >
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square top-3/4 right-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square bottom-3/4 right-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            color,
            "w-3/5 h-4/5",
            "w-full h-full mb-auto rounded-b-full relative"
          )}
        >
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square left-3/4 bottom-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
          <div
            className={cn(
              color,
              "absolute w-[clamp(6px,45%,25px)] aspect-square right-3/4 bottom-1/2 rounded-full flex items-center justify-center"
            )}
          >
            <div className="bg-white w-[clamp(4px,75%,18px)] aspect-square rounded-full flex items-center justify-center">
              <div className="bg-black w-[clamp(4px,65%,18px)] aspect-square rounded-full"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
