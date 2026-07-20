import sqlite3 from 'sqlite3';

const dbPath = 'C:/dev/n8n-youtube-shorts-automation/.n8n/database.sqlite';
const workflowId = 'baekse100Life01';

function mustReplace(code, from, to) {
  if (!code.includes(from)) {
    throw new Error(`missing replacement target: ${from.slice(0, 120)}`);
  }
  return code.replace(from, to);
}

function patchCode(code) {
  if (code.includes('function safePublicText(value)')) return code;

  code = mustReplace(
    code,
`const ctaComment = '\uAC74\uAC15\uC7A5\uC218\uBE44\uACB0';


const sortedItems = [...(pack.rank_items || [])].sort((a, b) => Number(a.rank) - Number(b.rank));`,
`const ctaComment = '\uAC74\uAC15\uC7A5\uC218\uBE44\uACB0';

function safePublicText(value) {
  let text = String(value || '');
  const replacements = [
    [/\uC885\uD569\uC601\uC591\uC81C/g, '\uC885\uD569 \uAC74\uAC15\uC81C\uD488'],
    [/\uC601\uC591\uC81C/g, '\uAC74\uAC15\uC81C\uD488'],
    [/\uAD00\uC808\\s*\uBCF4\uC870\uC2DD\uD488/g, '\uBCF4\uC870 \uC81C\uD488'],
    [/\uBCF4\uC870\uC2DD\uD488/g, '\uBCF4\uC870 \uC81C\uD488'],
    [/\uAC74\uAC15\uC999/g, '\uC999 \uC74C\uB8CC'],
    [/\uBCF5\uC6A9/g, '\uC0AC\uC6A9'],
    [/\uCC98\uBC29/g, '\uC0C1\uB2F4 \uB0B4\uC6A9'],
    [/\uCE58\uB8CC/g, '\uAD00\uB9AC'],
    [/\uC644\uCE58/g, '\uAC1C\uC120'],
    [/\uC608\uBC29/g, '\uBBF8\uB9AC \uC810\uAC80'],
    [/\uBCD1\uC6D0\uBE44/g, '\uC0DD\uD65C\uBE44'],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text.replace(/\\s+/g, ' ').trim();
}

function sanitizeImageInstruction(value) {
  let text = String(value || '');
  const replacements = [
    [/\\bmedical\\b/gi, 'lifestyle'],
    [/\\bdoctor\\b/gi, 'person'],
    [/\\bcure\\b/gi, 'benefit'],
    [/\\btreatment\\b/gi, 'care'],
    [/\\bclinic-inspired\\b/gi, 'clean checklist'],
    [/\\bclinic\\b/gi, 'clean service'],
    [/\\bpharmacy\\b/gi, 'organized shop'],
    [/\\bhealth\\b/gi, 'wellbeing'],
    [/\\bbefore-after\\b/gi, 'comparison'],
    [/\\bbody icons\\b/gi, 'simple habit icons'],
    [/\\bproduct packaging\\b/gi, 'real branded packaging'],
    [/\\bfake doctor identity\\b/gi, 'human impersonation'],
  ];
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return safePublicText(text).replace(/\\s+/g, ' ').trim();
}

const sortedItems = [...(pack.rank_items || [])]
  .map((item) => ({
    ...item,
    name: safePublicText(item.name),
    reason: safePublicText(item.reason),
    caution: safePublicText(item.caution),
  }))
  .sort((a, b) => Number(a.rank) - Number(b.rank));`
  );

  code = mustReplace(
    code,
`const title = pack.hook_title || pack.theme || ('Health ranking TOP ' + (sortedItems.length || cfg.rank_count || 5));
const subtitle = pack.subtitle || '\uB9E4\uC77C \uD558\uB294\uB370 \uB193\uCE58\uAE30 \uC26C\uC6B4 \uAC83\uB4E4';`,
`const title = safePublicText(pack.hook_title || pack.theme || ('\uC0DD\uD65C \uB7AD\uD0B9 TOP ' + (sortedItems.length || cfg.rank_count || 5)));
const subtitle = safePublicText(pack.subtitle || '\uB9E4\uC77C \uD558\uB294\uB370 \uB193\uCE58\uAE30 \uC26C\uC6B4 \uAC83\uB4E4');`
  );

  const replacements = [
    [
      "prompt: 'Bright clinic-inspired checklist without medical logos, mint, ivory, charcoal and coral palette, flat icon badges, airy spacing, rounded checklist ticks.',",
      "prompt: 'Bright clean checklist style, mint, ivory, charcoal and coral palette, flat icon badges, airy spacing, rounded checklist ticks.',",
    ],
    [
      "prompt: 'Elegant Korean health magazine cover layout, burgundy, forest green, cream and black palette, large editorial title, numbered side rail, tasteful object photography icons.',",
      "prompt: 'Elegant Korean lifestyle magazine cover layout, burgundy, forest green, cream and black palette, large editorial title, numbered side rail, tasteful object photography icons.',",
    ],
    [
      "'pharmacy shelf objects, labels, and clean product silhouettes without logos',",
      "'organized shelf objects, labels, and clean item silhouettes without logos',",
    ],
    [
      "'walking shoes, stairs, towel, and body-care icons',",
      "'walking shoes, stairs, towel, and simple daily habit icons',",
    ],
    [
      "'clinic clipboard, simple body icons, and clean medical-neutral shapes',",
      "'clean clipboard, simple daily habit icons, and neutral geometric shapes',",
    ],
    [
      "'abstract geometric health dashboard shapes with no brand marks',",
      "'abstract geometric wellbeing dashboard shapes with no brand marks',",
    ],
    [
      "'This run visual profile: ' + visualProfile.title + '. ' + visualProfile.prompt,",
      "'This run visual profile: ' + sanitizeImageInstruction(visualProfile.title) + '. ' + sanitizeImageInstruction(visualProfile.prompt),",
    ],
    [
      "'Randomized art direction for this run: layout family = ' + layoutFamily + '; palette = ' + paletteFamily + '; rank badge style = ' + badgeFamily + '; motif = ' + motifFamily + '. Follow these choices strongly.',",
      "'Randomized art direction for this run: layout family = ' + sanitizeImageInstruction(layoutFamily) + '; palette = ' + sanitizeImageInstruction(paletteFamily) + '; rank badge style = ' + sanitizeImageInstruction(badgeFamily) + '; motif = ' + sanitizeImageInstruction(motifFamily) + '. Follow these choices strongly.',",
    ],
    [
      "pack.visual_mood_hint ? 'Pack visual hint: ' + pack.visual_mood_hint : '',",
      "pack.visual_mood_hint ? 'Pack visual hint: ' + sanitizeImageInstruction(pack.visual_mood_hint) : '',",
    ],
    [
      "'Design quality: high-end Korean health, finance, and lifestyle app advertisement quality; crisp Korean typography; sharp vector-like edges; clean grid; premium editorial information card; polished not amateur.',",
      "'Design quality: high-end Korean lifestyle and practical information advertisement quality; crisp Korean typography; sharp vector-like edges; clean grid; premium editorial information card; polished not amateur.',",
    ],
    [
      "'Avoid: empty lifestyle-photo background, transparent dark overlay panel, stock photo feel, brand logos, medical logos, product packaging, fake doctor identity, before-after imagery, cure/treatment guarantees.',",
      "'Keep it neutral: no empty stock-photo background, no transparent dark overlay panel, no real brand logos, no real product labels, no impersonation, no shocking imagery, no dramatic transformation comparison.',",
    ],
  ];

  for (const [from, to] of replacements) code = mustReplace(code, from, to);
  return code;
}

const db = new sqlite3.Database(dbPath);

db.get('SELECT nodes FROM workflow_entity WHERE id=?', [workflowId], (error, row) => {
  if (error) throw error;
  if (!row) throw new Error(`workflow not found: ${workflowId}`);

  const nodes = JSON.parse(row.nodes);
  const node = nodes.find((entry) => entry.name === 'Prepare Image and BGM Payloads');
  if (!node) throw new Error('node not found: Prepare Image and BGM Payloads');

  const before = node.parameters.jsCode || '';
  const after = patchCode(before);
  node.parameters.jsCode = after;

  db.run(
    "UPDATE workflow_entity SET nodes=?, updatedAt=strftime('%Y-%m-%d %H:%M:%f','now'), versionCounter=versionCounter+1 WHERE id=?",
    [JSON.stringify(nodes), workflowId],
    function onUpdated(updateError) {
      if (updateError) throw updateError;
      console.log(JSON.stringify({
        updatedRows: this.changes,
        changed: before !== after,
        nodes: nodes.length,
      }));
      db.close();
    },
  );
});
