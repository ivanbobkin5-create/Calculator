const fs = require('fs');

let file = fs.readFileSync('src/components/Projects/SpecificationPrintView.tsx', 'utf8');

file = file.replace(
  /\{p\.data\?\.summaryRows \? Array\.from\(new Set\(p\.data\.summaryRows\.filter\(\(r: any\) => r\.type === 'material'\)\.map\(\(r: any\) => \`\$\{r\.category \|\| ''\} \$\{r\.decor && r\.decor !== '-' \? r\.decor : \(r\.name \|\| ''\)\}\`\.trim\(\)\)\.filter\(Boolean\)\)\)\.join\(', '\) : \(p\.data\?\.results \? Array\.from\(new Set\(Object\.values\(p\.data\.results\)\.map\(\(r: any\) => \`\$\{r\.category \|\| ''\} \$\{r\.decor && r\.decor !== '-' \? r\.decor : \(r\.name \|\| ''\)\}\`\.trim\(\)\)\.filter\(Boolean\)\)\)\.join\(', '\) : '-'\)\}/g,
  `{p.data?.summaryRows ? Array.from(new Set(p.data.summaryRows.filter((r: any) => r.type === 'material').map((r: any) => \`\${r.name || ''} \${r.sub || ''} \${r.decor && r.decor !== '-' ? r.decor : ''}\`.trim()).filter(Boolean))).join(', ') : (p.data?.results ? Array.from(new Set(Object.keys(p.data.results).map((k: any) => \`\${p.data.results[k].name || p.data.results[k].type || ''} \${p.data.results[k].color || ''} \${p.data.selectedDecor?.[k] || ''}\`.trim()).filter(Boolean))).join(', ') : '-')}`
);

file = file.replace(
  /\{p\.data\?\.summaryRows \? Array\.from\(new Set\(p\.data\.summaryRows\.filter\(\(r: any\) => r\.type === 'edge' \|\| r\.type === 'product_edge'\)\.map\(\(r: any\) => \`\$\{r\.decor && r\.decor !== '-' \? r\.decor : \(r\.name \|\| ''\)\}\`\.trim\(\)\)\.filter\(Boolean\)\)\)\.join\(', '\) : \(p\.data\?\.edgeDecor \? Array\.from\(new Set\(Object\.values\(p\.data\.edgeDecor\)\.flatMap\(\(e: any\) => typeof e === 'string' \? \[e\] : Object\.values\(e\)\)\)\)\.join\(', '\) : '-'\)\}/g,
  `{p.data?.summaryRows ? Array.from(new Set(p.data.summaryRows.filter((r: any) => r.type === 'edge' || r.type === 'product_edge').map((r: any) => \`\${r.decor && r.decor !== '-' ? r.decor : (r.name || '')}\`.trim()).filter(Boolean))).join(', ') : (p.data?.edgeDecor ? Array.from(new Set(Object.values(p.data.edgeDecor).flatMap((e: any) => typeof e === 'string' ? [e] : Object.values(e)))).join(', ') : '-')}`
);


file = file.replace(
  /\{p\.data\?\.facadeCustomType \? \`Свой: \$\{Object\.values\(p\.data\.facadeCustomType\)\.join\(', '\)\}\` : \(p\.data\?\.facadeType \? \`\$\{Object\.values\(p\.data\.facadeType\)\.join\(', '\)\} \$\{p\.data\?\.facadeCategory \? Object\.values\(p\.data\.facadeCategory\)\.join\(', '\) : ''\} \$\{p\.data\?\.facadeMilling \? Object\.values\(p\.data\.facadeMilling\)\.join\(', '\) : ''\}\` : '-'\)\}/g,
  `{p.data?.facadeCustomType && Object.values(p.data.facadeCustomType).filter(Boolean).length > 0 ? \`Свой: \${Object.values(p.data.facadeCustomType).filter(Boolean).join(', ')}\` : (p.data?.facadeType && Object.values(p.data.facadeType).filter((v: any)=>v==='sheet').length > 0 ? \`Листовой\` : '-')}`
);

fs.writeFileSync('src/components/Projects/SpecificationPrintView.tsx', file);
