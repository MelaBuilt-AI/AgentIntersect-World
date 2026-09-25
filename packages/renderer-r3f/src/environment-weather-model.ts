import {
  ENVIRONMENT_FX,
  type EnvironmentWeather,
} from "@agentintersect-world/world-schema/environment";
export type WeatherStrike = {
  local: boolean;
  x: number;
  z: number;
  variant: number;
};
export type WeatherStrikeHandler = (strike: WeatherStrike) => void;
const random = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Fixed seeded buffers, one draw call, never a React node per particle. */
export function weatherPositions(weather: EnvironmentWeather): Float32Array {
  const count =
    weather.particles === "none"
      ? 0
      : Math.round(
          (weather.particles === "heavy-rain" ? 1152 : 384) * weather.intensity,
        );
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++)
    points.set(
      [
        (random(i * 3) - 0.5) * 48,
        random(i * 3 + 1) * 24,
        (random(i * 3 + 2) - 0.5) * 48,
      ],
      i * 3,
    );
  return points;
}
export function lightningStrike(
  sequence: number,
  weather: EnvironmentWeather,
  size: number,
  user: { x: number; z: number },
): WeatherStrike {
  const local =
    weather.lightning === "local" ||
    (weather.lightning === "both" && sequence % 2 === 1);
  const angle = random(sequence + 17) * Math.PI * 2;
  const radius = local ? 5 + random(sequence + 41) * 11 : 220;
  const edge = Math.max(1, size / 2 - 3);
  return {
    local,
    x: local
      ? Math.max(-edge, Math.min(edge, user.x + Math.sin(angle) * radius))
      : Math.sin(angle) * radius,
    z: local
      ? Math.max(-edge, Math.min(edge, user.z + Math.cos(angle) * radius))
      : Math.cos(angle) * radius,
    variant: sequence % 3,
  };
}
/** Camera-relative sky coverage, not one bolt that is usually behind the viewer. */
export function skyLightningLayout(strike: WeatherStrike, intensity: number) {
  if (strike.local) return [];
  const count = 3 + Math.round(intensity * 5);
  const start = Math.atan2(strike.x, strike.z);
  return Array.from({ length: count }, (_, index) => {
    const angle = start + (index * Math.PI * 2) / count;
    return {
      x: Math.sin(angle) * 220,
      z: Math.cos(angle) * 220,
      y: 55 + random(index + strike.variant * 11) * 40,
      scale: 3.5 + random(index + 71) * 1.5,
    };
  });
}

type HorizonLightning = NonNullable<EnvironmentWeather["horizonLightning"]>;
export function horizonLightningCount(settings: HorizonLightning) {
  return settings.density === 0 ? 0 : 4 + Math.round(settings.density * 20);
}

/** Quick individual flashes staggered across distant regions, not a sky strobe. */
export function horizonLightningSample(
  index: number,
  time: number,
  settings: HorizonLightning,
) {
  const phase = ((index * 0.61803398875) % 1) * settings.interval;
  const cycle = Math.floor((time + phase) / settings.interval);
  const age = (time + phase) % settings.interval;
  const seed = index * 13 + cycle * 37;
  const angle =
    (index * Math.PI * 2) / horizonLightningCount(settings) +
    (random(seed + 2) - 0.5) * 0.1;
  const height = 18 + random(seed + 4) * 18;
  return {
    x: Math.sin(angle) * 390,
    z: Math.cos(angle) * 390,
    y:
      Math.tan((settings.elevation * Math.PI) / 180) * 390 +
      (random(seed + 6) - 0.5) * 8 +
      height / 2,
    height,
    roll: (random(seed + 8) - 0.5) * 0.4,
    frame: [1, 4, 7, 9, 10, 12][(index + cycle) % 6]!,
    opacity: age < 0.42 ? Math.sin((Math.PI * age) / 0.42) * 0.9 : 0,
  };
}

/** Slow authored flicker to two seconds; never replay the supplier's 40fps strobe. */
export function atlasFrame(
  id: keyof typeof ENVIRONMENT_FX,
  age: number,
): number | null {
  const fps = id.startsWith("fx_lightning")
    ? 8
    : Math.min(ENVIRONMENT_FX[id].fps, 20);
  const frame = Math.floor(age * fps);
  return frame < 0 || frame >= 16 ? null : frame;
}
export const WEATHER_VERTEX = `
uniform float time; uniform float wind; uniform float kind; uniform float viewport;
varying float seed;
void main(){
 seed=fract(sin(dot(position.xz,vec2(127.1,311.7)))*43758.5453);
 vec3 p=position;
 float fall=kind<1.5? 14.0 : kind<2.5? 1.4 : kind<3.5? 0.7 : 0.3;
 if(kind>3.5&&kind<4.5) fall=-0.4;
 if(kind>7.5) fall=-1.0;
 p.y=mod(position.y-time*fall,24.0);
 p.x=mod(position.x+time*(0.4+wind*7.0)+sin(time*0.6+seed*25.0)*(0.4+wind),48.0)-24.0;
 p.z=mod(position.z+sin(time*0.3+seed*13.0)*(1.0+wind),48.0)-24.0;
 vec4 mv=modelViewMatrix*vec4(p,1.0);
 gl_Position=projectionMatrix*mv;
 float size=kind<1.5?0.32:kind<2.5?0.16:kind<3.5?0.22:kind<4.5?0.3:kind<5.5?1.2:kind<6.5?0.24:kind<7.5?0.2:0.28;
 gl_PointSize=clamp(size*viewport/max(1.0,-mv.z),1.5,kind<1.5?36.0:24.0);
}`;
export const WEATHER_FRAGMENT = `
uniform float kind; uniform float time; uniform float wind;
varying float seed;
void main(){
 vec2 p=gl_PointCoord-0.5; float a; vec3 color;
 if(kind<1.5){p.x+=p.y*wind*0.5;a=(1.0-smoothstep(0.025,0.09,abs(p.x)))*(1.0-smoothstep(0.2,0.5,abs(p.y)));color=vec3(0.65,0.82,0.94);a*=0.55;}
 else if(kind<2.5){a=1.0-smoothstep(0.15,0.48,length(p));color=vec3(0.9,0.96,1.0);}
 else if(kind<3.5){a=1.0-smoothstep(0.1,0.48,length(p));color=vec3(0.52,0.48,0.45);a*=0.55;}
 else if(kind<4.5){a=max(pow(max(0.0,1.0-length(p)*2.0),2.0),0.65*(1.0-smoothstep(0.015,0.04,min(abs(p.x),abs(p.y))))*(1.0-smoothstep(0.15,0.5,length(p))));color=mix(vec3(0.5,0.75,1.0),vec3(1.0,0.85,0.45),seed);a*=0.6+0.4*sin(time+seed*20.0);}
 else if(kind<5.5){a=(1.0-smoothstep(0.01,0.04,abs(p.y+sin(p.x*5.0+time)*0.08)))*(1.0-smoothstep(0.1,0.5,abs(p.x)));color=vec3(0.75,0.84,0.85);a*=0.23;}
 else if(kind<6.5){float angle=seed*6.28+time; p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;a=1.0-smoothstep(0.36,0.48,length(p*vec2(1.0,2.4)));color=mix(vec3(0.28,0.4,0.09),vec3(0.85,0.37,0.08),seed);}
 else if(kind<7.5){a=1.0-smoothstep(0.05,0.48,length(p));color=vec3(0.76,0.54,0.3);a*=0.35;}
 else {a=pow(max(0.0,1.0-length(p)*2.0),2.0);color=vec3(1.0,0.33+seed*0.35,0.05);}
 if(a<0.01)discard;gl_FragColor=vec4(color,a);
}`;
