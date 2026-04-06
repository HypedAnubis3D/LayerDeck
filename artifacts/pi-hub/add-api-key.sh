#!/bin/bash
node -e "
const fs=require('fs');
const p=require('os').homedir()+'/bambu-hub/config.json';
const c=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
c.anthropicApiKey='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';
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log('Done. Config keys:', Object.keys(c).join(', '));
"
