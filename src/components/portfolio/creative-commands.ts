type LineKind = "input" | "output" | "system" | "error" | "success" | "muted";
type CreativeContext = {
  args: string[];
  arg: string;
  push: (kind: LineKind, text: string) => void;
  pushMany: (kind: LineKind, texts: string[]) => void;
  isAlive: () => boolean;
};
type CreativeCommand = {
  name: string;
  usage?: string;
  desc: string;
  run: (ctx: CreativeContext) => void | Promise<void>;
};

const pickRandom = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
const randomHex = () => `#${randomInt(0xffffff).toString(16).padStart(6, "0").toUpperCase()}`;
const listInput = (args: string[]) => args.join(" ").split(",").map((item) => item.trim()).filter(Boolean);
const shuffled = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

const QUOTES = [
  "Make it useful, then make it beautiful, then make it resilient.",
  "Every pixel has a purpose; every packet has a story.",
  "Creativity is engineering with the constraints temporarily removed.",
  "The best interface is a small universe you want to explore.",
  "Security is a journey with unusually interesting logs.",
];
const JOKES = [
  "I would tell you a UDP joke, but you might not get it.",
  "The firewall has trust issues. Excellent. That is its job.",
  "My favorite exercise is running out of memory.",
  "There are only 10 kinds of people: those who understand binary and those who do not.",
  "CSS is easy until the designer says ‘just one small change’.",
];
const FACTS = [
  "The first computer bug was a real moth found in a relay in 1947.",
  "The QWERTY layout predates modern computers by almost a century.",
  "The first webcam watched a coffee pot at the University of Cambridge.",
  "Mandelbrot sets contain finite area but infinite boundary detail.",
  "Conway's Game of Life is Turing complete.",
];
const TIPS = [
  "Rotate credentials before they become souvenirs.",
  "A green lock does not replace input validation.",
  "Backups are real only after a successful restore test.",
  "Log the event, not the secret.",
  "Least privilege makes the smallest blast radius.",
];
const IDEA_SUBJECTS = ["an ASCII observatory", "a zero-server synth", "a holographic résumé", "a tiny security game", "a procedural forest"];
const IDEA_FEATURES = ["with keyboard-only controls", "with a secret Matrix channel", "that reacts to the pointer", "with shareable PNG exports", "with daily generative seeds"];
const CODE_WORDS = ["NEBULA", "CIPHER", "AURORA", "ORBIT", "PHOENIX", "VECTOR", "ZION", "PULSAR"];
const PASS_WORDS = ["orbit", "cactus", "photon", "velvet", "rocket", "meadow", "cipher", "lantern", "comet", "willow"];
const PLANET_NAMES = ["Aurelia", "Kepler-42", "Nova Prime", "Cygnus IX", "Andromeda Minor"];
const RIDDLES = [
  ["I have keys but open no locks. I have space but no room. What am I?", "a keyboard"],
  ["I speak without a mouth and repeat every word. What am I?", "an echo"],
  ["The more you take from me, the larger I become. What am I?", "a hole"],
  ["I run without legs and have a bank without money. What am I?", "a river"],
];
const POEM_START = ["Silent signals", "Emerald pixels", "Distant engines", "Midnight branches", "Electric rivers"];
const POEM_MIDDLE = ["orbit through the dark", "whisper to the stars", "compile a small sunrise", "dance around the flame", "carry dreams upstream"];
const POEM_END = ["and dawn returns", "inside the machine", "beneath quiet constellations", "while the forest listens", "beyond the final frame"];

export const CREATIVE_COMMANDS: CreativeCommand[] = [
  { name: "quote", desc: "print a creative engineering quote", run: ({ push }) => push("output", pickRandom(QUOTES)) },
  { name: "joke", desc: "tell a programming joke", run: ({ push }) => push("output", pickRandom(JOKES)) },
  { name: "fact", desc: "show a surprising technology fact", run: ({ push }) => push("output", pickRandom(FACTS)) },
  { name: "tip", desc: "get a practical security tip", run: ({ push }) => push("output", pickRandom(TIPS)) },
  { name: "idea", desc: "generate a creative project idea", run: ({ push }) => push("output", `Build ${pickRandom(IDEA_SUBJECTS)} ${pickRandom(IDEA_FEATURES)}.`) },
  { name: "codename", desc: "generate a mission codename", run: ({ push }) => push("output", `MISSION ${pickRandom(CODE_WORDS)}-${pickRandom(CODE_WORDS)}-${randomInt(90) + 10}`) },
  { name: "palette", desc: "generate a five-color palette", run: ({ push }) => push("output", Array.from({ length: 5 }, randomHex).join("  ")) },
  { name: "gradient", desc: "generate a CSS gradient", run: ({ push }) => push("output", `background: linear-gradient(135deg, ${randomHex()}, ${randomHex()});`) },
  { name: "color", desc: "generate a random color", run: ({ push }) => { const hex = randomHex(); push("output", `${hex} · rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`); } },
  { name: "binary", usage: "<text>", desc: "convert text to binary", run: ({ arg, push }) => push("output", [...(arg || "P00RIJA")].map((char) => char.codePointAt(0)!.toString(2).padStart(8, "0")).join(" ")) },
  { name: "hex", usage: "<text>", desc: "convert text to hexadecimal", run: ({ arg, push }) => push("output", [...(arg || "P00RIJA")].map((char) => char.codePointAt(0)!.toString(16).padStart(2, "0")).join(" ")) },
  { name: "reverse", usage: "<text>", desc: "reverse text", run: ({ arg, push }) => push("output", [...(arg || "universe")].reverse().join("")) },
  { name: "scramble", usage: "<text>", desc: "scramble the letters", run: ({ arg, push }) => push("output", shuffled([...(arg || "creativity")]).join("")) },
  { name: "leet", usage: "<text>", desc: "convert text to leetspeak", run: ({ arg, push }) => push("output", (arg || "elite code").replace(/[aeiost]/gi, (char) => ({ a: "4", e: "3", i: "1", o: "0", s: "5", t: "7" })[char.toLowerCase()]!)) },
  { name: "vaporwave", usage: "<text>", desc: "space out text aesthetically", run: ({ arg, push }) => push("output", [...(arg || "A E S T H E T I C")].join(" ")) },
  { name: "clap", usage: "<text>", desc: "add dramatic claps", run: ({ args, push }) => push("output", (args.length ? args : ["ship", "it"]).join(" 👏 ")) },
  { name: "mock", usage: "<text>", desc: "alternating-case text", run: ({ arg, push }) => push("output", [...(arg || "mocking text")].map((char, index) => index % 2 ? char.toUpperCase() : char.toLowerCase()).join("")) },
  { name: "titlecase", usage: "<text>", desc: "convert text to title case", run: ({ arg, push }) => push("output", (arg || "three worlds one signature").replace(/\b\w/g, (char) => char.toUpperCase())) },
  { name: "slug", usage: "<text>", desc: "make a URL-safe slug", run: ({ arg, push }) => push("output", (arg || "Three Worlds One Signature").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) },
  { name: "wordcount", usage: "<text>", desc: "count words", run: ({ arg, push }) => push("output", `${arg.trim() ? arg.trim().split(/\s+/).length : 0} words`) },
  { name: "charcount", usage: "<text>", desc: "count characters", run: ({ arg, push }) => push("output", `${[...arg].length} characters`) },
  { name: "palindrome", usage: "<text>", desc: "check a palindrome", run: ({ arg, push }) => { const text = (arg || "level").toLowerCase().replace(/[^a-z0-9]/g, ""); push("output", `${text} → ${text === [...text].reverse().join("") ? "PALINDROME" : "NOT A PALINDROME"}`); } },
  { name: "anagram", usage: "<word>", desc: "generate an anagram", run: ({ arg, push }) => push("output", shuffled([...(arg || "orbit")]).join("")) },
  { name: "passphrase", desc: "generate a memorable passphrase", run: ({ push }) => push("output", `${Array.from({ length: 4 }, () => pickRandom(PASS_WORDS)).join("-")}-${randomInt(90) + 10}`) },
  { name: "pin", desc: "generate a random six-digit PIN", run: ({ push }) => push("output", String(randomInt(900000) + 100000)) },
  { name: "nonce", desc: "generate a random hexadecimal nonce", run: ({ push }) => push("output", Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")) },
  { name: "roll", usage: "[NdM]", desc: "roll RPG dice (e.g. 3d20)", run: ({ arg, push }) => { const match = /^(\d{1,2})?d(\d{1,4})$/i.exec(arg || "1d6"); if (!match) return push("error", "usage: roll 3d20"); const count = Math.min(100, Number(match[1] || 1)); const sides = Math.max(2, Number(match[2])); const rolls = Array.from({ length: count }, () => randomInt(sides) + 1); push("output", `${count}d${sides}: [${rolls.join(", ")}] = ${rolls.reduce((sum, value) => sum + value, 0)}`); } },
  { name: "pick", usage: "<a,b,c>", desc: "pick a random list item", run: ({ args, push }) => { const items = listInput(args); push("output", items.length ? pickRandom(items) : "usage: pick red,green,blue"); } },
  { name: "shuffle-list", usage: "<a,b,c>", desc: "shuffle a list", run: ({ args, push }) => push("output", shuffled(listInput(args)).join(", ") || "usage: shuffle-list a,b,c") },
  { name: "sort-list", usage: "<a,b,c>", desc: "sort a list", run: ({ args, push }) => push("output", listInput(args).sort((a, b) => a.localeCompare(b)).join(", ") || "usage: sort-list c,a,b") },
  { name: "unique", usage: "<a,b,c>", desc: "remove duplicate list items", run: ({ args, push }) => push("output", [...new Set(listInput(args))].join(", ") || "usage: unique a,a,b") },
  { name: "countdown", usage: "[seconds]", desc: "run a short countdown", run: async ({ arg, push, isAlive }) => { const count = Math.min(10, Math.max(1, Number(arg) || 3)); for (let value = count; value >= 1; value--) { if (!isAlive()) return; push("output", `${value}…`); await sleep(700); } if (isAlive()) push("success", "LIFTOFF"); } },
  { name: "timer", usage: "[seconds]", desc: "start a short local timer", run: async ({ arg, push, isAlive }) => { const seconds = Math.min(10, Math.max(1, Number(arg) || 5)); push("muted", `timer started: ${seconds}s`); await sleep(seconds * 1000); if (isAlive()) push("success", `TIMER COMPLETE · ${seconds}s`); } },
  { name: "progress", desc: "animate a tiny progress bar", run: async ({ push, isAlive }) => { for (let value = 0; value <= 10; value++) { if (!isAlive()) return; push("output", `[${"█".repeat(value)}${"░".repeat(10 - value)}] ${value * 10}%`); await sleep(100); } } },
  { name: "stars", desc: "generate a pocket night sky", run: ({ pushMany }) => pushMany("output", Array.from({ length: 8 }, () => Array.from({ length: 48 }, () => Math.random() > 0.91 ? pickRandom([".", "+", "*", "✦"]) : " ").join(""))) },
  { name: "galaxy", desc: "generate an ASCII spiral galaxy", run: ({ pushMany }) => { const rows = Array.from({ length: 17 }, () => Array(45).fill(" ")); for (let point = 0; point < 240; point++) { const angle = point * 0.16; const radius = point / 240; const x = Math.round(22 + Math.cos(angle) * radius * 21); const y = Math.round(8 + Math.sin(angle) * radius * 7); if (rows[y]?.[x] !== undefined) rows[y][x] = point % 5 ? "." : "*"; } pushMany("output", rows.map((row) => row.join(""))); } },
  { name: "planet", desc: "discover a procedural planet", run: ({ push }) => push("output", `${pickRandom(PLANET_NAMES)} · ${pickRandom(["ocean world", "crystal desert", "forest moon", "volcanic giant", "frozen archive"])} · ${randomInt(900) + 100} million km`) },
  { name: "alien", desc: "receive an alien transmission", run: ({ pushMany }) => pushMany("success", ["  .--.", " / oo \\", "| ()() |", "  \\__/", "TRANSMISSION: YOUR LITTLE UNIVERSE IS DELIGHTFUL."]) },
  { name: "ufo", desc: "render a tiny UFO", run: ({ pushMany }) => pushMany("output", ["       .--------.", "  ___ /  o  o  \\___", " /__\\____________/__\\", "    /  |  |  |  \\", "   /_______________\\"]) },
  { name: "satellite", desc: "render an orbital satellite", run: ({ pushMany }) => pushMany("output", ["  [====]     |     [====]", "           /|\\", "      ---- /_\\ ----", "          /___\\", "     SIGNAL LOCKED · 99.9%"]) },
  { name: "comet", desc: "animate a comet crossing the shell", run: async ({ push, isAlive }) => { for (let frame = 0; frame < 10; frame++) { if (!isAlive()) return; push("success", `${" ".repeat(frame * 4)}☄ ${"·".repeat(Math.max(0, 18 - frame * 2))}`); await sleep(90); } } },
  { name: "launch", desc: "launch a pocket spacecraft", run: async ({ push, pushMany, isAlive }) => { for (const value of [3, 2, 1]) { if (!isAlive()) return; push("output", `T-${value}`); await sleep(400); } pushMany("success", ["     /\\", "    /  \\", "   | 🚀 |", "  /______\\", "    /_\\", "   /___\\", "  /_____\\"]); } },
  { name: "radar", desc: "scan for fictional orbital contacts", run: ({ pushMany }) => pushMany("output", Array.from({ length: 4 }, (_, index) => `CONTACT 0${index + 1} · ${pickRandom(["friendly", "unknown", "research", "quiet"])} · az ${randomInt(360)}° · ${randomInt(900) + 100}km`)) },
  { name: "sonar", desc: "ping a fictional deep-sea scene", run: async ({ push, isAlive }) => { for (let index = 0; index < 4; index++) { if (!isAlive()) return; push("output", `))) ${"·".repeat(index * 5)} sonar return ${index + 1} · ${randomInt(400) + 20}m`); await sleep(180); } } },
  { name: "signal", desc: "measure a fictional space signal", run: ({ push }) => { const strength = randomInt(5) + 1; push("output", `${"▂▃▄▅▆▇".slice(0, strength)} ${strength * 20}% · ${strength > 3 ? "CLEAR CHANNEL" : "WEAK SIGNAL"}`); } },
  { name: "caesar", usage: "[shift] <text>", desc: "apply a Caesar cipher", run: ({ args, push }) => { const shift = Number(args[0]) || 3; const text = args.slice(1).join(" ") || "three worlds"; push("output", [...text].map((char) => { if (!/[a-z]/i.test(char)) return char; const base = char <= "Z" ? 65 : 97; return String.fromCharCode((char.charCodeAt(0) - base + shift) % 26 + base); }).join("")); } },
  { name: "prime", usage: "<number>", desc: "test whether a number is prime", run: ({ arg, push }) => { const value = Number(arg); if (!Number.isSafeInteger(value) || value < 0) return push("error", "usage: prime 97"); let prime = value >= 2; for (let divisor = 2; divisor * divisor <= value; divisor++) if (value % divisor === 0) { prime = false; break; } push("output", `${value} is ${prime ? "PRIME" : "NOT PRIME"}`); } },
  { name: "fib", usage: "[count]", desc: "generate Fibonacci numbers", run: ({ arg, push }) => { const count = Math.min(30, Math.max(1, Number(arg) || 10)); const values = [0, 1]; while (values.length < count) values.push(values.at(-1)! + values.at(-2)!); push("output", values.slice(0, count).join(" → ")); } },
  { name: "poem", desc: "compose a tiny procedural poem", run: ({ pushMany }) => pushMany("output", [pickRandom(POEM_START), pickRandom(POEM_MIDDLE), pickRandom(POEM_END)]) },
  { name: "riddle", desc: "ask a riddle and reveal its answer", run: async ({ push, isAlive }) => { const [question, answer] = pickRandom(RIDDLES); push("output", `RIDDLE: ${question}`); await sleep(900); if (isAlive()) push("muted", `ANSWER: ${answer}`); } },
];
