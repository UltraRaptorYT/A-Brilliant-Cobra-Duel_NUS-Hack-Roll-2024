export type PosType = [number, number];

export type SnakeType = {
  body: PosType[];
  dir: Direction;
  prevDir: Direction;
  dirArr: Direction[];
  isAlive: boolean;
};

export type Direction = "U" | "D" | "L" | "R";

export type BoardStateType = {
  turn: number;
  snake1: SnakeType;
  snake2: SnakeType;
  food: PosType[];
};

export type GameBoardProps = {
  size: number;
  board: number[][];
  boardState: BoardStateType;
};

export type SnakeProps = {
  dir?: Direction;
  color: string;
  keyProp: string;
};
