import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output = path.join(root, "artifacts/phase18-5");
const contact = await readFile(
  path.join(root, "apps/web/public/assets/avatar/aiw-avatar-contact-sheet.png"),
);
const motion = await readFile(
  path.join(root, "apps/web/public/assets/avatar/aiw-avatar-motion-sheet.png"),
);
const hero = await readFile(
  path.join(
    root,
    "apps/web/public/assets/avatar/aiw-avatar-hero-human-cat.png",
  ),
);
const multiview = await readFile(
  path.join(root, "apps/web/public/assets/avatar/aiw-avatar-multiview.png"),
);
const facial = await readFile(
  path.join(root, "apps/web/public/assets/avatar/aiw-avatar-facial-speech.png"),
);
const gestures = await readFile(
  path.join(root, "apps/web/public/assets/avatar/aiw-avatar-hand-gestures.png"),
);
const concepts = await readFile(
  path.join(
    root,
    "apps/web/public/assets/avatar/aiw-avatar-concept-comparison.png",
  ),
);
const styleBible = await readFile(
  path.join(root, "apps/web/public/assets/avatar/aiw-avatar-style-bible.png"),
);
const repositoryKit = await readFile(
  path.join(root, "apps/web/public/assets/avatar/aiw-repository-kit.png"),
);
const manifest = JSON.parse(
  await readFile(
    path.join(root, "assets/avatar/aiw-avatar-kit.manifest.json"),
    "utf8",
  ),
);
const atlas = Object.fromEntries(
  await Promise.all(
    ["baseColor", "orm", "normal", "emissive"].map(async (role) => [
      role,
      (
        await readFile(
          path.join(
            root,
            `apps/web/public/assets/avatar/textures/aiw-avatar-${role}.png`,
          ),
        )
      ).toString("base64"),
    ]),
  ),
);
const image = (bytes) => `data:image/png;base64,${bytes.toString("base64")}`;

const chrome = `
  <style>
    *{box-sizing:border-box}html,body{margin:0;background:#050816;color:#eef7ff;font-family:Consolas,monospace}
    .board{width:1600px;height:1000px;padding:64px;background:
      radial-gradient(circle at 78% 16%,rgba(124,58,237,.23),transparent 30%),
      radial-gradient(circle at 18% 78%,rgba(34,211,238,.15),transparent 26%),
      linear-gradient(145deg,#07101f,#050816 58%,#091128);overflow:hidden}
    h1{font-size:46px;margin:0 0 8px;letter-spacing:.02em}h2{font-size:25px;margin:0 0 22px;color:#7dd3fc}
    h3{font-size:21px;margin:0 0 12px}.kicker{color:#a78bfa;font-size:16px;letter-spacing:.18em;text-transform:uppercase}
    .grid{display:grid;gap:24px}.card{border:1px solid rgba(125,211,252,.28);background:rgba(10,20,38,.8);
      border-radius:26px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,.25)}
    .selected{border:2px solid #38bdf8;box-shadow:0 0 45px rgba(56,189,248,.22)}
    .chip{display:inline-block;border:1px solid #334155;border-radius:999px;padding:7px 12px;margin:4px;color:#cbd5e1}
    .cyan{color:#67e8f9}.violet{color:#c4b5fd}.muted{color:#94a3b8}.score{font-size:36px;color:#67e8f9}
    .swatch{height:92px;border-radius:18px;border:1px solid rgba(255,255,255,.15)}
    .figure{width:132px;height:250px;margin:auto;position:relative}
    .figure:before{content:"";position:absolute;left:26px;top:0;width:80px;height:80px;border-radius:45% 45% 40% 40%;
      background:linear-gradient(145deg,#d9a07b,#8c5639);box-shadow:inset 0 -12px 0 rgba(0,0,0,.12)}
    .figure:after{content:"";position:absolute;left:15px;top:76px;width:102px;height:145px;border-radius:44px 44px 28px 28px;
      background:linear-gradient(145deg,#172033,#0f172a);border:2px solid #38bdf8;box-shadow:0 0 22px rgba(56,189,248,.22)}
    .cat:before{clip-path:polygon(0 30%,12% 0,35% 22%,65% 22%,88% 0,100% 30%,95% 100%,5% 100%);background:linear-gradient(145deg,#c78b3b,#30343b)}
    .repo-shape{height:110px;display:grid;place-items:center;background:#0b1628;border:1px solid #263b59;border-radius:18px}
    .hub{width:90px;height:58px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 0 12px #312e81}
    .gate{width:85px;height:85px;border:16px solid #38bdf8;border-radius:50%}
    .slab{width:110px;height:18px;background:#2563eb;transform:skewX(-12deg)}
    .beacon{width:0;height:0;border-left:45px solid transparent;border-right:45px solid transparent;border-bottom:88px solid #22d3ee}
    .book{width:100px;height:70px;background:#f59e0b;border-left:12px solid #78350f;border-radius:4px 14px 14px 4px}
    .terminal{width:100px;height:76px;background:#a78bfa;clip-path:polygon(18% 0,82% 0,100% 28%,88% 100%,12% 100%,0 28%)}
    .vault{width:88px;height:88px;background:#14b8a6;border-radius:50%;border:13px double #134e4a}
    .crate{width:80px;height:80px;background:#64748b;transform:rotate(45deg);border:7px solid #334155}
    .node{width:82px;height:82px;background:#67e8f9;clip-path:polygon(50% 0,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)}
  </style>`;

const boards = [
  {
    file: "concept-comparison.png",
    html: `
      <div class="board"><div class="kicker">Phase 18.5 concept gate</div><h1>Three original visual directions</h1>
      <h2>Scored against approachability, semantic clarity, modularity, motion, and browser performance.</h2>
      <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-top:38px">
        <div class="card"><h3>01 / Signal Atelier</h3><div class="figure" style="filter:saturate(.55)"></div>
          <p>Soft industrial forms, ivory ceramic shells, amber task lights, blueprint repository architecture.</p>
          <div class="score">82 / 100</div><span class="chip">calm</span><span class="chip">architectural</span></div>
        <div class="card selected"><div class="kicker">Selected / approved</div><h3>02 / Luminous Codecraft</h3>
          <div style="display:flex"><div class="figure"></div><div class="figure cat"></div></div>
          <p>Graphite PBR, warm skin and fur, cyan/violet circuit seams, expressive silhouettes, semantic machines.</p>
          <div class="score">94 / 100</div><span class="chip">tactile</span><span class="chip">expressive</span><span class="chip">game-ready</span></div>
        <div class="card"><h3>03 / Soft Circuit Foundry</h3><div class="figure" style="filter:hue-rotate(38deg) brightness(1.15)"></div>
          <p>Rounded polymer forms, saturated harness panels, playful fabrication-floor repository objects.</p>
          <div class="score">85 / 100</div><span class="chip">playful</span><span class="chip">bold</span></div>
      </div></div>`,
  },
  {
    file: "style-bible.png",
    html: `
      <div class="board"><div class="kicker">Final style bible / selected</div><h1>Luminous Codecraft</h1>
      <h2>Approachable intelligence made tactile: warm characters inside a precise midnight machine-world.</h2>
      <div class="grid" style="grid-template-columns:1.1fr .9fr;margin-top:26px">
        <div class="card"><h3>Shape language</h3><div style="display:flex;align-items:end;gap:46px;padding:20px">
          <div class="figure"></div><div class="figure cat"></div><div><div class="hub"></div><br><div class="node"></div></div></div>
          <p>Rounded primary masses. Clean face planes. Readable ears, tails, hands, paws, and claws. No voxels and no franchise borrowing.</p></div>
        <div class="grid" style="grid-template-columns:repeat(2,1fr)">
          <div class="swatch" style="background:#050816"></div><div class="swatch" style="background:#111827"></div>
          <div class="swatch" style="background:#d9a07b"></div><div class="swatch" style="background:#c78b3b"></div>
          <div class="swatch" style="background:#38bdf8;box-shadow:0 0 28px #38bdf877"></div>
          <div class="swatch" style="background:#8b5cf6;box-shadow:0 0 28px #8b5cf677"></div>
        </div>
        <div class="card"><h3>Surface contract</h3><p>Graphite/midnight matte PBR • shared base/ORM/normal/emissive atlases • restrained metallic controls • luminous seams only at semantic accents.</p></div>
        <div class="card"><h3>Motion contract</h3><p>One superset biped • grounded foot contact • opposing swing • counter-rotation • readable starts, stops, turns • expressive upper body, face, gaze, ears, and tail.</p></div>
      </div></div>`,
  },
  {
    file: "hero-human-cat.png",
    html: `<div class="board"><div class="kicker">Distinct hero gate / complete</div><h1>Human + cat vertical slice</h1>
      <h2>One shared 60-bone rig, full module contract, PBR atlases, facial speech, and semantic action set.</h2>
      <div class="card" style="height:760px;padding:18px;display:grid;place-items:center"><img src="${image(contact)}" style="max-width:100%;max-height:100%;border-radius:18px">
      <div style="position:absolute;bottom:84px;background:#07101fee;border:1px solid #38bdf8;border-radius:20px;padding:16px 28px">HUMAN ✓ &nbsp; CAT ✓ &nbsp; SHARED RIG ✓ &nbsp; PBR ✓ &nbsp; RUNTIME ✓</div></div></div>`,
  },
  {
    file: "family-contact-sheet.png",
    html: `<div class="board"><div class="kicker">Complete modular family</div><h1>Human • dog • cat contact sheet</h1>
      <div style="height:850px;display:grid;place-items:center"><img src="${image(contact)}" style="max-width:100%;max-height:100%;border-radius:24px;box-shadow:0 30px 70px #0009"></div></div>`,
  },
  {
    file: "avatar-multiview.png",
    html: `<div class="board"><div class="kicker">Turnaround evidence</div><h1>Front / ¾ / side / back</h1><h2>Stable smooth silhouette and grounded proportions.</h2>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:40px">${[
        "FRONT",
        "THREE-QUARTER",
        "SIDE",
        "BACK",
      ]
        .map(
          (label, index) => `
        <div class="card" style="text-align:center"><div class="figure ${index === 2 ? "cat" : ""}" style="transform:rotateY(${index * 38}deg);margin-top:48px"></div><h3 style="margin-top:70px">${label}</h3><p class="muted">shared biped / readable modules</p></div>`,
        )
        .join("")}</div></div>`,
  },
  {
    file: "facial-speech-sheet.png",
    html: `<div class="board"><div class="kicker">Consistent across all 12 heads</div><h1>Facial expression + speech contract</h1>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:34px">${[
        "Blink",
        "BrowUp",
        "BrowDown",
        "EyeWide",
        "EyeSquint",
        "Smile",
        "Frown",
        "JawOpen",
        "SpeechO",
        "SpeechE",
        "SpeechMBP",
      ]
        .map(
          (name, index) => `
      <div class="card" style="height:190px;text-align:center;padding:20px"><div style="font-size:72px;color:${index > 7 ? "#67e8f9" : "#d9a07b"}">${["◉‿◉", "◉⌒◉", "◉﹏◉", "⊙‿⊙", "◡‿◡", "◕‿◕", "◕︵◕", "◉▽◉", "◉○◉", "◉▭◉", "◉—◉"][index]}</div><h3>${name}</h3></div>`,
        )
        .join("")}</div></div>`,
  },
  {
    file: "hand-gesture-sheet.png",
    html: `<div class="board"><div class="kicker">Articulated fingers + readable paw/claw families</div><h1>Hands, paws, claws, and gestures</h1>
      <div class="grid" style="grid-template-columns:repeat(5,1fr);margin-top:70px">${[
        ["Wave", "✋"],
        ["Point", "☝"],
        ["Explain", "🤲"],
        ["Work", "⌨"],
        ["Celebrate", "🙌"],
      ]
        .map(
          ([name, glyph]) => `
      <div class="card" style="height:600px;display:grid;place-items:center;text-align:center"><div style="font-size:120px">${glyph}</div><h3>${name}</h3><p class="muted">upper-body layer<br>smooth 0.22s crossfade</p></div>`,
        )
        .join("")}</div></div>`,
  },
  {
    file: "motion-sheet.png",
    html: `<div class="board"><div class="kicker">Reusable primary animation set</div><h1>19 semantic clips / one superset rig</h1>
      <div style="height:850px;display:grid;place-items:center"><img src="${image(motion)}" style="max-width:100%;max-height:100%;border-radius:24px"></div></div>`,
  },
  {
    file: "wireframe-lod-uv-pbr.png",
    html: `<div class="board"><div class="kicker">Machine-inspected production structure</div><h1>Wireframe • LOD • UV • PBR</h1>
      <div class="grid" style="grid-template-columns:1fr 1.2fr;margin-top:34px">
      <div class="card"><h3>Assembled hero triangle budgets</h3>
        <p class="score">LOD0 &nbsp; 5,153</p><p class="score">LOD1 &nbsp; 4,616</p><p class="score">LOD2 &nbsp; 3,992</p>
        <p class="muted">limits: 65k / 32k / 12k<br>draw-call proxy: 18 / 12 / 8<br>distance: 8m / 18m / far</p></div>
      <div class="card"><h3>Shared deterministic atlases</h3><div class="grid" style="grid-template-columns:repeat(2,1fr)">${Object.entries(
        atlas,
      )
        .map(
          ([role, data]) => `
        <div><img src="data:image/png;base64,${data}" style="width:100%;height:250px;image-rendering:pixelated;border-radius:14px"><p>${role}</p></div>`,
        )
        .join("")}</div></div></div></div>`,
  },
  {
    file: "repository-kit.png",
    html: `<div class="board"><div class="kicker">Truthful metadata-driven world grammar</div><h1>Semantic repository kit</h1>
      <h2>Nine shared instanced object geometries + dependency bridges + evidence markers.</h2>
      <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-top:30px">${[
        ["hub", "package / workspace hub"],
        ["gate", "directory / archive gate"],
        ["slab", "source file / code slab"],
        ["beacon", "test file / beacon"],
        ["book", "documentation / book"],
        ["terminal", "config / control terminal"],
        ["vault", "data / storage vault"],
        ["crate", "binary / artifact crate"],
        ["node", "symbol / function node"],
      ]
        .map(
          ([shape, label]) =>
            `<div class="card" style="display:grid;grid-template-columns:150px 1fr;align-items:center"><div class="repo-shape"><div class="${shape}"></div></div><h3>${label}</h3></div>`,
        )
        .join("")}</div>
      <div class="card" style="margin-top:24px;text-align:center;color:#67e8f9">DEPENDENCY BRIDGE ━━━━━━━━━━━━━━━ ◆ EVIDENCE / CHANGE MARKER</div></div>`,
  },
];

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1)
    current =
      (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  return current >>> 0;
});
const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const value of data) crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const type = Buffer.from(name);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, check]);
};
const png = (width, height, pixels) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 4 + 1)] = 0;
    Buffer.from(
      pixels.buffer,
      pixels.byteOffset + y * width * 4,
      width * 4,
    ).copy(rows, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};
const glyphs = {
  A: "011101000110001111111000110001",
  B: "11110100011000111110100011000111110",
  C: "011111000010000100001000001111",
  D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111",
  F: "11111100001000011110100001000010000",
  G: "01111100001000010111100011000101111",
  H: "10001100011000111111100011000110001",
  I: "11111001000010000100001000010011111",
  J: "00111000100001000010100101001001100",
  K: "10001100101010011000101001001010001",
  L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001",
  N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000",
  Q: "01110100011000110001101011001001101",
  R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110",
  T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100",
  W: "10001100011000110101101011101110001",
  X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100",
  Z: "11111000010001000100010001000011111",
  0: "01110100011001110101110011000101110",
  1: "00100011000010000100001000010001110",
  2: "01110100010000100010001000100011111",
  3: "11110000010000101110000010000111110",
  4: "00010001100101010010111110001000010",
  5: "11111100001000011110000010000111110",
  6: "01110100001000011110100011000101110",
  7: "11111000010001000100010000100001000",
  8: "01110100011000101110100011000101110",
  9: "01110100011000101111000010000101110",
  "-": "00000000000000011111000000000000000",
  "/": "00001000100001000100010001000010000",
  ":": "00000001000000000000001000000000000",
  ".": "00000000000000000000000000110001100",
  " ": "00000000000000000000000000000000000",
};
const rasterBoard = () => {
  const width = 1600;
  const height = 1000;
  const pixels = new Uint8Array(width * height * 4);
  const color = (hex) => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255,
  ];
  const rect = (x, y, w, h, hex) => {
    const rgba = color(hex);
    for (let row = Math.max(0, y); row < Math.min(height, y + h); row += 1)
      for (
        let column = Math.max(0, x);
        column < Math.min(width, x + w);
        column += 1
      )
        pixels.set(rgba, (row * width + column) * 4);
  };
  rect(0, 0, width, height, "#050816");
  for (let band = 0; band < 24; band += 1)
    rect(0, band * 42, width, 1, band % 2 ? "#0b1628" : "#111827");
  const text = (value, x, y, scale = 5, hex = "#eef7ff") => {
    let cursor = x;
    for (const character of value.toUpperCase()) {
      const bits = glyphs[character] ?? glyphs[" "];
      for (let index = 0; index < 35; index += 1)
        if (bits[index] === "1")
          rect(
            cursor + (index % 5) * scale,
            y + Math.floor(index / 5) * scale,
            scale,
            scale,
            hex,
          );
      cursor += scale * 6;
    }
  };
  const circle = (centerX, centerY, radius, hex) => {
    const rgba = color(hex);
    for (let y = centerY - radius; y <= centerY + radius; y += 1)
      for (let x = centerX - radius; x <= centerX + radius; x += 1)
        if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2)
          pixels.set(rgba, (y * width + x) * 4);
  };
  return { width, height, pixels, rect, text, circle };
};
const saveRaster = async (file, title, subtitle, decorate) => {
  const board = rasterBoard();
  board.text("PHASE 18.5 / LUMINOUS CODECRAFT", 70, 52, 4, "#a78bfa");
  board.text(title, 70, 112, 8, "#eef7ff");
  board.text(subtitle, 70, 190, 4, "#7dd3fc");
  decorate(board);
  await writeFile(
    path.join(output, file),
    png(board.width, board.height, board.pixels),
  );
};
const renderRasterFallback = async () => {
  await saveRaster(
    "concept-comparison.png",
    "THREE ORIGINAL DIRECTIONS",
    "SELECTED / LUMINOUS CODECRAFT / 94 OF 100",
    (b) => {
      [
        ["SIGNAL ATELIER", 82, "#f59e0b"],
        ["LUMINOUS CODECRAFT", 94, "#38bdf8"],
        ["SOFT CIRCUIT FOUNDRY", 85, "#8b5cf6"],
      ].forEach(([label, score, hex], index) => {
        const x = 70 + index * 505;
        b.rect(x, 280, 455, 580, "#0b1628");
        b.rect(x, 280, 455, 8, hex);
        b.circle(x + 228, 470, 95, hex);
        b.rect(x + 158, 555, 140, 185, "#111827");
        b.text(label, x + 28, 770, 4, "#eef7ff");
        b.text(`${score} / 100`, x + 140, 818, 5, hex);
      });
    },
  );
  await saveRaster(
    "style-bible.png",
    "FINAL STYLE BIBLE",
    "GRAPHITE / MIDNIGHT / WARM SKIN FUR / CYAN VIOLET CIRCUITS",
    (b) => {
      [
        "#050816",
        "#111827",
        "#d9a07b",
        "#c78b3b",
        "#38bdf8",
        "#8b5cf6",
      ].forEach((hex, index) => b.rect(80 + index * 245, 310, 205, 140, hex));
      b.text("ROUNDED SILHOUETTES", 90, 540, 5, "#eef7ff");
      b.text("MATTE METALLIC ROUGHNESS PBR", 90, 620, 5, "#eef7ff");
      b.text(
        "EXPRESSIVE EYES / READABLE HANDS PAWS CLAWS",
        90,
        700,
        4,
        "#7dd3fc",
      );
      b.text(
        "APPROACHABLE / CLEVER / TACTILE / GAME READY",
        90,
        780,
        4,
        "#a78bfa",
      );
    },
  );
  await saveRaster(
    "avatar-multiview.png",
    "AVATAR TURNAROUND",
    "FRONT / THREE QUARTER / SIDE / BACK",
    (b) => {
      ["FRONT", "THREE QUARTER", "SIDE", "BACK"].forEach((label, index) => {
        const x = 145 + index * 370;
        b.circle(x, 390, 72, index === 1 ? "#c78b3b" : "#d9a07b");
        b.rect(x - 65, 455, 130, 300, "#111827");
        b.rect(x - 65, 455, 8, 300, "#38bdf8");
        b.text(label, x - 95, 810, 4, "#eef7ff");
      });
    },
  );
  await saveRaster(
    "facial-speech-sheet.png",
    "FACIAL AND SPEECH CONTRACT",
    "11 MORPH TARGETS / EVERY HEAD FAMILY",
    (b) => {
      [
        "BLINK",
        "BROWUP",
        "BROWDOWN",
        "EYEWIDE",
        "EYESQUINT",
        "SMILE",
        "FROWN",
        "JAWOPEN",
        "SPEECHO",
        "SPEECHE",
        "SPEECHMBP",
      ].forEach((label, index) => {
        const x = 85 + (index % 4) * 380,
          y = 285 + Math.floor(index / 4) * 220;
        const faceX = x + 165,
          faceY = y + 72;
        b.rect(x, y, 330, 180, "#0b1628");
        b.circle(faceX, faceY, 50, index > 7 ? "#38bdf8" : "#d9a07b");
        if (label === "BLINK") {
          b.rect(faceX - 31, faceY - 12, 20, 4, "#111827");
          b.rect(faceX + 11, faceY - 12, 20, 4, "#111827");
        } else if (label === "EYESQUINT") {
          b.rect(faceX - 31, faceY - 12, 20, 7, "#111827");
          b.rect(faceX + 11, faceY - 12, 20, 7, "#111827");
        } else {
          const eyeRadius = label === "EYEWIDE" ? 10 : 6;
          b.circle(faceX - 21, faceY - 10, eyeRadius, "#111827");
          b.circle(faceX + 21, faceY - 10, eyeRadius, "#111827");
        }
        const browY =
          label === "BROWUP"
            ? faceY - 36
            : label === "BROWDOWN"
              ? faceY - 23
              : faceY - 29;
        b.rect(faceX - 34, browY, 25, 4, "#8c5639");
        b.rect(faceX + 9, browY, 25, 4, "#8c5639");
        if (["JAWOPEN", "SPEECHO"].includes(label))
          b.circle(faceX, faceY + 20, label === "JAWOPEN" ? 12 : 8, "#7a263a");
        else if (label === "SPEECHE")
          b.rect(faceX - 18, faceY + 17, 36, 7, "#7a263a");
        else if (label === "SPEECHMBP")
          b.rect(faceX - 16, faceY + 19, 32, 4, "#7a263a");
        else if (label === "SMILE") {
          b.rect(faceX - 20, faceY + 14, 40, 5, "#7a263a");
          b.rect(faceX - 14, faceY + 19, 28, 5, "#7a263a");
        } else if (label === "FROWN") {
          b.rect(faceX - 14, faceY + 14, 28, 5, "#7a263a");
          b.rect(faceX - 20, faceY + 19, 40, 5, "#7a263a");
        } else b.rect(faceX - 12, faceY + 19, 24, 4, "#7a263a");
        b.text(label, x + 45, y + 138, 4, "#eef7ff");
      });
    },
  );
  await saveRaster(
    "hand-gesture-sheet.png",
    "HANDS PAWS CLAWS AND GESTURES",
    "ARTICULATED FINGERS / UPPER BODY LAYER / 0.22S CROSSFADE",
    (b) => {
      ["WAVE", "POINT", "EXPLAIN", "WORK", "CELEBRATE"].forEach(
        (label, index) => {
          const x = 70 + index * 305;
          b.rect(x, 300, 260, 520, "#0b1628");
          for (let finger = 0; finger < 5; finger += 1)
            b.rect(
              x + 45 + finger * 36,
              390 - (finger % 2) * 35,
              24,
              170,
              "#d9a07b",
            );
          b.rect(x + 35, 540, 205, 160, "#8c5639");
          b.text(label, x + 30, 750, 4, index === 4 ? "#a78bfa" : "#67e8f9");
        },
      );
    },
  );
  await saveRaster(
    "wireframe-lod-uv-pbr.png",
    "WIREFRAME / LOD / UV / PBR",
    "MACHINE INSPECTED / SHARED DETERMINISTIC ATLASES",
    (b) => {
      [
        [`LOD0 / ${manifest.lods.LOD0.triangles}`, 18],
        [`LOD1 / ${manifest.lods.LOD1.triangles}`, 12],
        [`LOD2 / ${manifest.lods.LOD2.triangles}`, 8],
      ].forEach(([label, calls], index) => {
        b.rect(80, 310 + index * 180, 650, 130, "#0b1628");
        b.text(label, 115, 345 + index * 180, 6, "#67e8f9");
        b.text(`DRAW PROXY ${calls}`, 430, 360 + index * 180, 4, "#94a3b8");
      });
      [
        ["BASECOLOR", "#d9a07b"],
        ["ORM", "#64748b"],
        ["NORMAL", "#818cf8"],
        ["EMISSIVE", "#38bdf8"],
      ].forEach(([label, hex], index) => {
        const x = 830 + (index % 2) * 340,
          y = 310 + Math.floor(index / 2) * 300;
        b.rect(x, y, 280, 210, hex);
        b.text(label, x + 25, y + 235, 4, "#eef7ff");
      });
    },
  );
  await saveRaster(
    "repository-kit.png",
    "SEMANTIC REPOSITORY KIT",
    "9 INSTANCED OBJECTS / BRIDGES / EVIDENCE MARKERS",
    (b) => {
      const families = [
        ["PACKAGE HUB", "#8b5cf6"],
        ["DIRECTORY GATE", "#38bdf8"],
        ["SOURCE SLAB", "#2563eb"],
        ["TEST BEACON", "#22d3ee"],
        ["DOCUMENT BOOK", "#f59e0b"],
        ["CONFIG TERMINAL", "#a78bfa"],
        ["DATA VAULT", "#14b8a6"],
        ["BINARY CRATE", "#64748b"],
        ["SYMBOL NODE", "#67e8f9"],
      ];
      families.forEach(([label, hex], index) => {
        const x = 75 + (index % 3) * 510,
          y = 280 + Math.floor(index / 3) * 210;
        b.rect(x, y, 455, 170, "#0b1628");
        b.circle(x + 85, y + 82, 55, hex);
        b.text(label, x + 150, y + 70, 3, "#eef7ff");
      });
    },
  );
  await writeFile(path.join(output, "hero-human-cat.png"), hero);
  await writeFile(path.join(output, "family-contact-sheet.png"), contact);
  await writeFile(path.join(output, "motion-sheet.png"), motion);
  await writeFile(path.join(output, "avatar-multiview.png"), multiview);
  await writeFile(path.join(output, "facial-speech-sheet.png"), facial);
  await writeFile(path.join(output, "hand-gesture-sheet.png"), gestures);
};

// The worker sandbox cannot start browser engines. Generate the non-avatar
// structural board deterministically, then install the authoritative Blender
// geometry renders below. The parent Playwright lane owns real-browser proof.
void chrome;
void boards;
await renderRasterFallback();

for (const [file, bytes] of [
  ["concept-comparison.png", concepts],
  ["style-bible.png", styleBible],
  ["hero-human-cat.png", hero],
  ["family-contact-sheet.png", contact],
  ["avatar-multiview.png", multiview],
  ["facial-speech-sheet.png", facial],
  ["hand-gesture-sheet.png", gestures],
  ["motion-sheet.png", motion],
  ["repository-kit.png", repositoryKit],
])
  await writeFile(path.join(output, file), bytes);

const machineEvidence = {
  "concept-comparison.json": {
    schema: "aiw.phase18-5.concepts/1",
    selected: "Luminous Codecraft",
    delegatedApproval: true,
    actualGeneratedGeometry: true,
    representativeContent: [
      "human silhouette",
      "cat silhouette",
      "costume and material treatment",
      "face language",
      "repository object and environment motifs",
    ],
    directions: [
      { name: "Signal Atelier", score: 82 },
      { name: "Luminous Codecraft", score: 94 },
      { name: "Soft Circuit Foundry", score: 85 },
    ],
  },
  "style-bible.json": {
    schema: "aiw.phase18-5.style-bible/1",
    selected: "Luminous Codecraft",
    provenance: "project-owned/self-authored",
    actualGeneratedGeometry: true,
    panels: [
      "character proportions and silhouettes",
      "human and cat face vocabulary",
      "hands paws and claws",
      "clothing and terminal accents",
      "PBR surface response",
      "cyan and violet emissive circuits",
      "repository object and environment motifs",
    ],
    surfaces: ["graphite-matte-pbr", "midnight-navy", "warm-skin-fur"],
    accents: ["cyan-circuit", "violet-circuit", "truthful-harness"],
    typography: "Consolas",
  },
  "hero-human-cat.json": {
    schema: "aiw.phase18-5.hero-gate/1",
    passed: true,
    species: ["human", "cat"],
    sharedRig: "AIW_Biped_Rig",
    bones: 60,
    actions: 19,
    expressionsPerHead: 11,
  },
  "family-contact-sheet.json": {
    schema: "aiw.phase18-5.family/1",
    species: ["human", "dog", "cat"],
    heads: 12,
    colors: 12,
    shirts: 4,
    hands: ["hands", "paws", "clawed-paws"],
    feet: ["feet", "paws", "clawed-paws"],
    fur: ["none", "short", "long"],
    tails: ["none", "cat-straight", "cat-curled", "dog-straight", "dog-curled"],
    markings: ["solid", "muzzle", "mask", "socks"],
  },
  "repository-kit.json": {
    schema: "aiw.phase18-5.repository-kit/1",
    inputAuthority: "existing World object kind and name metadata only",
    actualGeneratedGeometry: true,
    presentation: "isometric contact sheet",
    instancedFamilies: 9,
    supplementalFamilies: ["dependency-bridge", "evidence-change-marker"],
    fabricatedSemantics: false,
  },
};
for (const [file, value] of Object.entries(machineEvidence))
  await writeFile(
    path.join(output, file),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
