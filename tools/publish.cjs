const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(cmd,args,quiet=false){return execFileSync(cmd,args,{cwd:root,encoding:'utf8',stdio:quiet?['ignore','pipe','pipe']:'inherit'});}
if(run('git',['status','--porcelain'],true).trim())throw Error('先に変更を確認してコミットしてください。');
for(const file of ['app.js','core.js','roster.js','research.js','ltk-relations.js'])run(process.execPath,['--check','site/'+file]);
run(process.execPath,['--test',...fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.cjs')).map(x=>'tests/'+x)]);
const sha=run('git',['subtree','split','--prefix=site','HEAD'],true).trim().split(/\r?\n/).pop();
if(!/^[a-f0-9]{40}$/.test(sha))throw Error('公開対象のコミットを取得できません。');
run('git',['push','origin',sha+':refs/heads/gh-pages']);
console.log('Published source: '+sha+' (gh-pages). Check the Pages build before reporting completion.');
