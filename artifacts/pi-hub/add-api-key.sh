#!/bin/bash
# Run this on the Pi to add your Anthropic API key to config.json
# scp this file to the Pi, then: bash ~/bambu-hub/add-api-key.sh

node -e "
const fs=require('fs');
const p=require('os').homedir()+'/bambu-hub/config.json';
const c=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
c.anthropicApiKey='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';
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log('Done. Config keys:', Object.keys(c).join(', '));
"
