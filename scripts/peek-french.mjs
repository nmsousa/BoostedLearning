import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('src/assets/flashcards/french.json', 'utf8'));

const OK = new Set(["he's","she's","it's","that's","there's","here's","what's","who's","let's","i'm","you're","we're","they're","i've","i'd","i'll","can't","won't","don't","doesn't","didn't","isn't","aren't","wasn't","weren't","couldn't","wouldn't","shouldn't","haven't","hasn't","o'clock"]);
const isJunk=(raw)=>{const s=raw.trim(),low=s.toLowerCase();if(!s)return true;if(low==="'s")return true;if(s.length===1&&low!=='i'&&low!=='a')return true;if(/^[a-z]\.$/i.test(s))return true;if(/['’]s$/i.test(s)&&!OK.has(low.replace('’',"'")))return true;return false;};
const isGerund=(s)=>/\w+ing$/i.test(s.trim())&&!/^[a-z]?ring$|^thing$|^spring$|^string$|^king$|^wing$/i.test(s.trim());
const isNeg=(s)=>/n['’]t$/i.test(s.trim());
const pick=(tr)=>{const all=(tr||[]).map(s=>s.trim()).filter(Boolean);if(!all.length)return'';if(!isJunk(all[0])&&!isGerund(all[0])&&!isNeg(all[0]))return all[0];const ok=all.filter(s=>!isJunk(s));if(!ok.length)return[...all].sort((a,b)=>a.length-b.length)[0];const pref=ok.filter(s=>!isGerund(s)&&!isNeg(s));if(pref.length)return pref[0];return ok[0];};

const words = ['tu parles','ça va',"j'ai",'est','de','à','il','elle','parle','femme','suis','es','master','maternel'];
for (const w of words) {
  const c = d.cards.find((x) => x.text === w);
  if (c) console.log(`${w}  ->  "${pick(c.translations)}"   [${c.translations.join(', ')}]`);
}
