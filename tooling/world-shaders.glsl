vec2 aiwStreamingUv(vec2 skyUv, float aiwSkyTime, float aiwSkyLayer) {
  float t = aiwSkyTime;
  if (aiwSkyLayer < 0.5) {
    // Sphere V increases toward the zenith: positive sampling offset falls down.
    return skyUv + vec2(0.0, t * 0.055);
  }
  if (aiwSkyLayer < 1.5) {
    // Rising, folding aurora curtains: streaming plus smooth lateral ripples.
    vec2 flow = skyUv + vec2(t * 0.006, -t * 0.022);
    flow.x += 0.045 * sin(skyUv.y * 6.283185 + t * 0.32)
      + 0.018 * sin(skyUv.y * 12.56637 - t * 0.21);
    flow.y += 0.035 * sin(skyUv.x * 6.283185 + t * 0.24);
    return flow;
  }
  // Foreground clouds cross the curtains on an independent, slower current.
  vec2 flow = skyUv + vec2(-t * 0.009, t * 0.008);
  flow.x += 0.03 * sin(skyUv.y * 6.283185 - t * 0.17);
  flow.y += 0.025 * sin(skyUv.x * 12.56637 + t * 0.19);
  return flow;
}

vec4 codeSky(sampler2D map, vec2 vMapUv, float aiwSkyTime, float aiwSkyLayer) {
vec4 skyColor=vec4(1.0);
  vec4 skyArt = texture2D(map, aiwStreamingUv(vMapUv, aiwSkyTime, aiwSkyLayer));
  float light = max(skyArt.r, max(skyArt.g, skyArt.b));
  // Supplied maps are RGB. Remove dark backing, not the luminous glyphColor artwork.
  skyColor.a *= skyArt.a * smoothstep(0.003, 0.028, light);
  float curtain = 0.88 + 0.12 * sin(vMapUv.x * 6.283185 - aiwSkyTime * 0.35);
  float glow = aiwSkyLayer < 0.5 ? 1.0 : (aiwSkyLayer < 1.5 ? 1.5 * curtain : 1.35);
  skyColor.rgb *= skyArt.rgb * glow;

return skyColor;
}

vec4 rewriteSurface(vec4 original, vec3 vWorldSurface, vec2 vEnvironmentRewriteUv, sampler2D environmentRewriteCode, float environmentRewriteTime, float environmentRewriteStrength) {
vec4 result=original;

if (environmentRewriteStrength > 0.001) {
vec3 p = vWorldSurface;
vec3 cell = floor(p*0.9);
float seed=fract(sin(dot(cell,vec3(127.1,311.7,74.7)))*43758.5453);
float wave=0.5+0.5*sin(environmentRewriteTime*3.0 + length(p.xz)*0.32 + p.y*0.12);
float circuit=pow(max(0.0,1.0-abs(sin(p.x*2.8+p.z*1.9+environmentRewriteTime*1.8))),26.0);
float spark=smoothstep(0.975,1.0,seed)*pow(wave,8.0);
float patches=smoothstep(0.35,0.85,seed)*wave;
vec3 rewriteColor=mix(result.rgb*0.35,vec3(0.25,0.85,1.0),max(circuit,spark));
result.rgb=mix(result.rgb,rewriteColor,environmentRewriteStrength*min(0.9,patches*0.55+circuit*0.55+spark));
// Independently staggered small surface patches, never a whole-screen strobe.
vec2 surfaceUv = vEnvironmentRewriteUv * vec2(18.0, 10.0);
vec2 tile = floor(surfaceUv);
float tick = floor(environmentRewriteTime * 11.0);
float burst = fract(sin(dot(tile, vec2(41.7, 113.1)) + tick * 19.19) * 43758.5453);
vec2 edge = smoothstep(vec2(0.0), vec2(0.08), fract(surfaceUv)) *
  (1.0 - smoothstep(vec2(0.92), vec2(1.0), fract(surfaceUv)));
float flash = step(0.76, burst) * edge.x * edge.y * environmentRewriteStrength;
// Complementary cells disappear into black while other cells expose streaming glyphColor.
// The disjoint thresholds prevent an erased patch from also flashing cyan.
float erase = (1.0 - step(0.24, burst)) * edge.x * edge.y * min(1.0, environmentRewriteStrength * 1.5);
result.rgb = mix(result.rgb, vec3(0.0), erase);
// Stream the supplied terminal-rain artwork through momentarily exposed sections.
vec2 codeUv = vEnvironmentRewriteUv * vec2(3.0, 2.0) + vec2(0.0, environmentRewriteTime * 0.42);
vec3 glyphColor = texture2D(environmentRewriteCode, codeUv).rgb;
float glyph = smoothstep(0.025, 0.32, max(glyphColor.r, max(glyphColor.g, glyphColor.b)));
vec3 exposedCode = mix(vec3(0.005, 0.035, 0.06), vec3(0.3, 0.92, 1.0), glyph);
result.rgb = mix(result.rgb, exposedCode, flash * 0.95);
}

return result;
}

float starHash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }


vec4 starfield(vec3 vSkyDirection, float density) {
  vec3 d = normalize(vSkyDirection);
  vec3 p = d * 370.0;
  vec3 cell = floor(p);
  float h = starHash(cell);
  vec3 center = cell + vec3(0.2) + 0.6*vec3(starHash(cell+1.0),starHash(cell+2.0),starHash(cell+3.0));
  float distanceToStar = length(p-center);
  float radius = mix(0.035,0.10,starHash(cell+4.0));
  float aa = max(length(fwidth(p))*0.5,0.025);
  float light = step(1.0-density,h)*(1.0-smoothstep(radius, radius+aa,distanceToStar));
  return vec4(vec3(0.002,0.004,0.012) + vec3(0.82,0.90,1.0)*light,1.0);}

vec3 weatherPosition(vec3 position, float time, float wind, float kind) {
float seed;

 seed=fract(sin(dot(position.xz,vec2(127.1,311.7)))*43758.5453);
 vec3 p=position;
 float fall=kind<1.5? 14.0 : kind<2.5? 1.4 : kind<3.5? 0.7 : 0.3;
 if(kind>3.5&&kind<4.5) fall=-0.4;
 if(kind>7.5) fall=-1.0;
 p.y=mod(position.y-time*fall,24.0);
 p.x=mod(position.x+time*(0.4+wind*7.0)+sin(time*0.6+seed*25.0)*(0.4+wind),48.0)-24.0;
 p.z=mod(position.z+sin(time*0.3+seed*13.0)*(1.0+wind),48.0)-24.0;

return p;
}

vec4 weatherColor(vec2 pointUv, float kind, float time, float wind, float seed) {

 vec2 p=pointUv-0.5; float a; vec3 color;
 if(kind<1.5){p.x+=p.y*wind*0.5;a=(1.0-smoothstep(0.025,0.09,abs(p.x)))*(1.0-smoothstep(0.2,0.5,abs(p.y)));color=vec3(0.65,0.82,0.94);a*=0.55;}
 else if(kind<2.5){a=1.0-smoothstep(0.15,0.48,length(p));color=vec3(0.9,0.96,1.0);}
 else if(kind<3.5){a=1.0-smoothstep(0.1,0.48,length(p));color=vec3(0.52,0.48,0.45);a*=0.55;}
 else if(kind<4.5){a=max(pow(max(0.0,1.0-length(p)*2.0),2.0),0.65*(1.0-smoothstep(0.015,0.04,min(abs(p.x),abs(p.y))))*(1.0-smoothstep(0.15,0.5,length(p))));color=mix(vec3(0.5,0.75,1.0),vec3(1.0,0.85,0.45),seed);a*=0.6+0.4*sin(time+seed*20.0);}
 else if(kind<5.5){a=(1.0-smoothstep(0.01,0.04,abs(p.y+sin(p.x*5.0+time)*0.08)))*(1.0-smoothstep(0.1,0.5,abs(p.x)));color=vec3(0.75,0.84,0.85);a*=0.23;}
 else if(kind<6.5){float angle=seed*6.28+time; p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;a=1.0-smoothstep(0.36,0.48,length(p*vec2(1.0,2.4)));color=mix(vec3(0.28,0.4,0.09),vec3(0.85,0.37,0.08),seed);}
 else if(kind<7.5){a=1.0-smoothstep(0.05,0.48,length(p));color=vec3(0.76,0.54,0.3);a*=0.35;}
 else {a=pow(max(0.0,1.0-length(p)*2.0),2.0);color=vec3(1.0,0.33+seed*0.35,0.05);}
 if(a<0.01)discard;return vec4(color,a);
}

vec4 terminalRain(sampler2D rainMap, vec2 rainUv, float rainTime, float rainHeight, float rainReach, float rainSpark, float rainVisible, float rainPulse, float rainStrength, vec3 rainColor) {
if (rainUv.y > rainReach || rainVisible < 0.001) discard;
          // Positive V sample motion makes the visible glyphs travel DOWN.
          vec3 glyphColor = texture2D(rainMap, vec2(rainUv.x, rainUv.y * rainHeight / 18.0 + rainTime)).rgb;
          float ink = max(glyphColor.r, max(glyphColor.g, glyphColor.b));
          float glyph = smoothstep(0.008, 0.055, ink);
          // Broad packets move at four world units/second, not hundreds of
          // units/second across the entire sky height. Six-second eased envelope.
          float pulse = 0.0;
          if (rainStrength > 0.0) {
            float packet = mod(rainUv.y * rainHeight + rainPulse * 24.0, 36.0);
            pulse = exp(-pow((packet - 18.0) / 5.0, 2.0)) * rainStrength;
          }
          vec3 tint = mix(vec3(0.12, 0.55, 0.76), rainColor, pulse);
          float root = smoothstep(0.0, 0.003, rainUv.y);
          float spark = exp(-pow((rainUv.y - rainReach) * rainHeight / 3.0, 2.0)) * rainSpark;
          return  vec4(tint * (1.0 + pulse * 0.35) + vec3(0.35, 0.7, 1.0) * spark,
            max(glyph * root * (0.65 + pulse * 0.15), spark * 0.6) * rainVisible);

}

vec4 arrival(vec4 original, vec3 aiwArrivalPosition, float aiwArrivalProgress, float aiwArrivalTime, float aiwArrivalFloor, float aiwArrivalHeight, sampler2D aiwArrivalRain) {
 // Small spatial cells assemble upward with staggered, stable thresholds.
  vec3 cell = floor(aiwArrivalPosition * 18.0);
  float noise = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float height = clamp((aiwArrivalPosition.y - aiwArrivalFloor) / aiwArrivalHeight, 0.0, 1.0);
  float threshold = height * 0.72 + noise * 0.28;
  if (threshold > aiwArrivalProgress) discard;
  float edge = 1.0 - smoothstep(0.0, 0.2, aiwArrivalProgress - threshold);
  vec2 rainUv = vec2(aiwArrivalPosition.x * 0.55 + aiwArrivalPosition.z * 0.3, aiwArrivalPosition.y * 0.55 + aiwArrivalTime * 0.24);
  vec3 glyphColor = texture2D(aiwArrivalRain, rainUv).rgb;
  vec3 outgoingLight = mix(original.rgb, glyphColor * 3.5 + vec3(0.03, 0.32, 0.46), edge);

return vec4(outgoingLight, original.a);
}

float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
}


vec4 baseFog(vec3 start, vec3 worldPosition, vec3 surface, vec3 center, vec3 extent, float time, float coverage) {
if (coverage < 0.01) discard;
vec3 direction=normalize(worldPosition-start);
float surfaceDistance = max(0.0,dot(surface-start,direction));
  // Analytic ray/ellipsoid bounds and continuous density integration.
  // No horizontal surfaces, marching steps or view-dependent layer count.
  vec3 origin = (start-center)/extent;
  vec3 ray = direction/extent;
  float a=dot(ray,ray), b=dot(origin,ray), c=dot(origin,origin)-1.0;
  float discriminant=b*b-a*c;
  if(discriminant<=0.0) discard;
  float root=sqrt(discriminant);
  float entry=max(0.0,(-b-root)/a);
  float exit=min(surfaceDistance,(-b+root)/a);
  if(exit<=entry) discard;
  float halfChord=root/a;
  float peak=discriminant/a;
  vec2 u=clamp((vec2(entry,exit)+b/a)/halfChord,-1.0,1.0);
  // Integral of (1-u*u)^2: u - 2*u^3/3 + u^5/5.
  vec2 integral=u - (u*u*u)*(2.0/3.0) + (u*u*u*u*u)/5.0;
  vec3 midpoint=start+direction*(entry+exit)*0.5;
  float wisps=0.5+0.5*noise(midpoint.xz*1.1+vec2(time*0.07,-time*0.035)+midpoint.y*0.4);
  float opticalDepth=max(0.0,integral.y-integral.x)*halfChord*peak*peak*wisps*0.35;
  float alpha=1.0-exp(-opticalDepth);
  return vec4(vec3(0.20,0.36,0.43),alpha);

}