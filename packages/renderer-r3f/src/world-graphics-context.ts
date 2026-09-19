import { createContext } from "react";
import {
  DEFAULT_WORLD_GRAPHICS,
  type WorldGraphics,
} from "./world-graphics.js";
export const WorldGraphicsContext = createContext<WorldGraphics>(
  DEFAULT_WORLD_GRAPHICS,
);
