// run_tests.mjs — يشغّل كل ملفات test_*.mjs بالمجلد الحالي، يطبع ملخص كل ملف، ويطلع بكود خطأ لو أي ملف فشل
import { readdirSync } from "fs";
import { spawnSync } from "child_process";

const testFiles = readdirSync(new URL(".", import.meta.url))
  .filter((f) => f.startsWith("test_") && f.endsWith(".mjs"))
  .sort();

let totalPass = 0, totalFail = 0, anyFileFailed = false;

for (const file of testFiles) {
  const result = spawnSync(process.execPath, [file], { encoding: "utf-8" });
  const output = result.stdout + result.stderr;
  const match = output.match(/النتيجة[^:]*: (\d+) ناجح، (\d+) فاشل/);
  if (match) {
    const [, pass, fail] = match.map(Number);
    totalPass += pass;
    totalFail += fail;
    console.log(`${fail > 0 ? "❌" : "✅"} ${file}: ${pass} ناجح، ${fail} فاشل`);
    if (fail > 0) anyFileFailed = true;
  } else {
    console.log(`❌ ${file}: انهار بدون نتيجة واضحة (كود خروج ${result.status})`);
    if (result.stderr) console.log(result.stderr.split("\n").slice(0, 10).join("\n"));
    anyFileFailed = true;
  }
}

console.log(`\n— الإجمالي: ${totalPass} ناجح، ${totalFail} فاشل عبر ${testFiles.length} ملف —`);
process.exit(anyFileFailed ? 1 : 0);
