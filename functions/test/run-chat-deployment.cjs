const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--test','--test-name-pattern=customer directory|support IDs','test/privacy.integration.cjs'],{stdio:'inherit',env:process.env});
process.exit(result.status ?? 1);
