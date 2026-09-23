/** IDs are the authority; recipes never carry paths, URLs or executable code. */
export const ENVIRONMENT_ASSETS = {
  "meadow-ground": {
    role: "ground",
    src: "/assets/environments/01_sandy_paths_and_grass.webp",
    tags: ["sand", "grass", "day"],
  },
  "mars-ground": {
    role: "ground",
    src: "/assets/environments/02_mars_red_sand_and_rocks.webp",
    tags: ["red", "sand", "rock"],
  },
  "day-sky": {
    role: "background",
    src: "/assets/environments/03_day_sky_blue_base.webp",
    tags: ["blue", "day"],
  },
  "mountain-horizon": {
    role: "middle",
    src: "/assets/environments/04_day_distant_mountain_horizon.webp",
    tags: ["mountains", "horizon"],
  },
  "day-clouds": {
    role: "foreground",
    src: "/assets/environments/05_day_puffy_clouds.webp",
    tags: ["clouds", "white"],
  },
  "space-sky": {
    role: "background",
    src: "/assets/environments/06_space_starfield_base.webp",
    tags: ["stars", "space"],
  },
  "space-planets": {
    role: "middle",
    src: "/assets/environments/07_space_moons_and_planets.webp",
    tags: ["moons", "planets"],
  },
  "space-gas": {
    role: "foreground",
    src: "/assets/environments/08_space_nebula_gas_swirls.webp",
    tags: ["gas", "nebula"],
  },
} as const;
export type EnvironmentAssetId = keyof typeof ENVIRONMENT_ASSETS;
export const ENVIRONMENT_AMBIENCE = [
  "blue-sky-sand-grass",
  "mars-swirling-gases",
  "alien-planet-loop",
  "birds-loop",
  "coding-beeps-chirps-loop",
  "rain-loop",
  "thunder-lightning-loop",
  "wind-loop",
] as const;
export type EnvironmentAmbience = (typeof ENVIRONMENT_AMBIENCE)[number];
