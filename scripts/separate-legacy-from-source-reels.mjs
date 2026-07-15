import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const files = [
  'workflows/n8n_geongangjangsubigyeol_manual.json',
  'workflows/n8n_하루건강약사_수동실행.json',
];

for (const relative of files) {
  const file = path.join(root, relative);
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  const load = workflow.nodes.find((node) => node.name === 'Load Config');
  const build = workflow.nodes.find((node) => node.name === 'Build Viral Rank Pack Request');
  const useLive = workflow.nodes.find((node) => node.name === 'Use Live KIE Claude?');
  if (!load || !build || !useLive) throw new Error(`${relative}: required legacy nodes missing`);

  const filterMarker = "!/(?:^|\\s)LOCKED_SOURCE_PACK=1(?:\\s|$)/.test(fs.readFileSync(entry.filePath, 'utf8'))";
  if (!load.parameters.jsCode.includes(filterMarker)) {
    const anchor = "    })\n    .sort((a, b) =>";
    if (!load.parameters.jsCode.includes(anchor)) throw new Error(`${relative}: pending-file list anchor missing`);
    load.parameters.jsCode = load.parameters.jsCode.replace(
      anchor,
      "    })\n    .filter((entry) => {\n      try { return !/(?:^|\\s)LOCKED_SOURCE_PACK=1(?:\\s|$)/.test(fs.readFileSync(entry.filePath, 'utf8')); }\n      catch (error) { return true; }\n    })\n    .sort((a, b) =>",
    );
  }

  build.parameters.jsCode = build.parameters.jsCode.replace(
    'const lockedSourcePack = queuedSourceLocked ? usableQueuedSpec : null;',
    'const lockedSourcePack = null;',
  );
  useLive.parameters.conditions.boolean[0].value1 = '={{$json.config.use_live_kie_ai}}';
  fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
  console.log(`separated ${workflow.name}`);
}
