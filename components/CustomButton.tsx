import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CustomButtonProps = {
  onClick: () => void;
  ready: boolean;
};

export default function CustomButton({ onClick, ready }: CustomButtonProps) {
  return (
    <Button
      onClick={() => {
        onClick();
      }}
      className={cn(
        ready
          ? "bg-red-500 hover:bg-red-400 dark:bg-red-500 dark:hover:bg-red-600"
          : "bg-green-500 hover:bg-green-400 dark:bg-green-500 dark:hover:bg-green-600",
        "text-white dark:text-white"
      )}
    >
      {ready ? "Not Ready" : "Ready"}
    </Button>
  );
}
