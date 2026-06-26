import fs from "fs";
import path from "path";

const exts = new Set([".ts", ".vue", ".sql"]);
const skip = new Set(["node_modules", ".nuxt", "dist", "scripts"]);

const reps = [
  ["/api/vacas", "/api/bovinos"],
  ['"/vacas', '"/bovinos'],
  ["`/vacas", "`/bovinos"],
  ['navigateTo("/vacas', 'navigateTo("/bovinos'],
  ['to="/vacas', 'to="/bovinos'],
  ['to: "/vacas', 'to: "/bovinos'],
  ["vaca_id", "bovino_id"],
  ["rebuildVacaContext", "rebuildBovinoContext"],
  ["findVacaByNombre", "findBovinoByNombre"],
  ["crearVaca", "crearBovino"],
  ["import { vacas }", "import { bovinos }"],
  ["from(vacas)", "from(bovinos)"],
  [".insert(vacas)", ".insert(bovinos)"],
  [".update(vacas)", ".update(bovinos)"],
  [".delete(vacas)", ".delete(bovinos)"],
  ["vacas.", "bovinos."],
  ["eq(vacas.", "eq(bovinos."],
  ["innerJoin(vacas,", "innerJoin(bovinos,"],
  ["JOIN vacas", "JOIN bovinos"],
  ["FROM vacas", "FROM bovinos"],
  ["INTO vacas", "INTO bovinos"],
  ["totalVacas", "totalBovinos"],
  ["resultado.vaca", "resultado.bovino"],
  ["pages/vacas", "pages/bovinos"],
  ["  vacas,", "  bovinos,"],
  ["  vacas\n", "  bovinos\n"],
];

function walk(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, fn);
    else fn(full);
  }
}

walk(".", (filePath) => {
  if (!exts.has(path.extname(filePath))) return;
  let content = fs.readFileSync(filePath, "utf8");
  let next = content;
  for (const [from, to] of reps) {
    next = next.split(from).join(to);
  }
  if (next !== content) {
    fs.writeFileSync(filePath, next);
  }
});

console.log("rename complete");
