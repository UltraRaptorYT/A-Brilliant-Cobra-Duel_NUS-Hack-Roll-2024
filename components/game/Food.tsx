export default function Food() {
  return (
    <div className="w-[clamp(20px,70%,35px)] aspect-square relative">
      <div className="absolute bg-green-600 w-1/2 aspect-video rounded-[100%] -top-[22.5%] left-[35%] -rotate-[20deg]"></div>
      <div className="bg-red-500 w-full aspect-square rounded-full"></div>
    </div>
  );
}
