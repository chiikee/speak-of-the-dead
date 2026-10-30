// --- KANA BANKS ---
// Common things ja-JP speech recognition writes when you say a lone syllable.
// (Each alternate belongs to one kana only, so they can't hit the wrong zombie.)
const SINGLE_ALTS = {
  'あ': ['亜', '阿', 'ああ'], 'い': ['胃', '井', 'いい'], 'う': ['鵜', '卯', 'うう'],
  'え': ['絵', '柄', 'ええ'], 'お': ['尾', '緒', 'を', 'おお'],
  'か': ['蚊', '課', '可', '価'], 'き': ['木', '気', '機', '期'], 'く': ['九', '区', '句', '苦', '9'],
  'け': ['毛'], 'こ': ['子', '個', '小', '故'],
  'さ': ['差', '佐'], 'し': ['四', '市', '死', '詩', '氏', '4'], 'す': ['巣', '酢'],
  'せ': ['背', '瀬'], 'そ': ['祖', 'そう'],
  'た': ['田', '他', '多'], 'ち': ['血', '地', '知'], 'つ': ['津'], 'て': ['手'], 'と': ['戸', '都'],
  'な': ['名', '菜'], 'に': ['二', '荷', '似', '2'], 'ぬ': [], 'ね': ['根', '寝', '値'], 'の': ['野', '之', '乃'],
  'は': ['歯', '葉', '刃'], 'ひ': ['日', '火', '非'], 'ふ': ['府', '負', '譜'], 'へ': ['屁'], 'ほ': ['帆', '穂', '歩'],
  'ま': ['間', '真'], 'み': ['身', '実', '3'], 'む': ['無'], 'め': ['目', '芽'], 'も': ['藻', '喪'],
  'や': ['矢', '屋', '8'], 'ゆ': ['湯'], 'よ': ['世', '夜'],
  'ら': ['等'], 'り': ['理', '利'], 'る': ['留'], 'れ': ['例'], 'ろ': ['炉', '呂'],
  'わ': ['輪', '和']
};
function makeSingles(kanaStr, romajiStr) {
  const romaji = romajiStr.split(' ');
  return [...kanaStr].map((k, i) => ({ kana: k, romaji: romaji[i], alts: SINGLE_ALTS[kataToHira(k)] || [] }));
}
// The 46 basic kana minus ん and を (を sounds exactly like お, and a lone ん is rarely recognised)
const SINGLE_HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ';
const SINGLE_ROMAJI = 'a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ' +
                      'ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa';

// Words are shown in kana (this is a kana trainer); kanji and English are accepted as alternates.
// Romaji uses doubled vowels for long sounds (raamen, koohii) so you can see how to say them.
const KANA_BANKS = {
  H_BASIC: makeSingles(SINGLE_HIRA, SINGLE_ROMAJI),
  K_BASIC: makeSingles(hiraToKata(SINGLE_HIRA), SINGLE_ROMAJI),
  H_WORDS: [
    { kana: 'ねこ', romaji: 'neko', alts: ['猫'] },          // cat
    { kana: 'いぬ', romaji: 'inu', alts: ['犬'] },           // dog
    { kana: 'さくら', romaji: 'sakura', alts: ['桜'] },      // cherry blossom
    { kana: 'すし', romaji: 'sushi', alts: ['寿司', '鮨'] }, // sushi
    { kana: 'みず', romaji: 'mizu', alts: ['水'] },          // water
    { kana: 'やま', romaji: 'yama', alts: ['山'] },          // mountain
    { kana: 'かわ', romaji: 'kawa', alts: ['川', '河'] },    // river
    { kana: 'はな', romaji: 'hana', alts: ['花', '鼻'] },    // flower / nose
    { kana: 'とり', romaji: 'tori', alts: ['鳥'] },          // bird
    { kana: 'つき', romaji: 'tsuki', alts: ['月'] },         // moon
    { kana: 'ほし', romaji: 'hoshi', alts: ['星'] },         // star
    { kana: 'きつね', romaji: 'kitsune', alts: ['狐'] },     // fox
    { kana: 'そら', romaji: 'sora', alts: ['空'] },          // sky
    { kana: 'うみ', romaji: 'umi', alts: ['海'] },           // sea
    { kana: 'ゆき', romaji: 'yuki', alts: ['雪'] },          // snow
    { kana: 'さかな', romaji: 'sakana', alts: ['魚'] },      // fish
    { kana: 'くるま', romaji: 'kuruma', alts: ['車'] },      // car
    { kana: 'おばけ', romaji: 'obake', alts: ['お化け'] },   // ghost
    { kana: 'ほね', romaji: 'hone', alts: ['骨'] },          // bone
    { kana: 'ゆうれい', romaji: 'yuurei', alts: ['幽霊'] }   // ghost, spirit
  ],
  K_WORDS: [
    { kana: 'ラーメン', romaji: 'raamen', alts: ['拉麺', 'ramen'] },
    { kana: 'カメラ', romaji: 'kamera', alts: ['camera'] },
    { kana: 'ホテル', romaji: 'hoteru', alts: ['hotel'] },
    { kana: 'タクシー', romaji: 'takushii', alts: ['taxi'] },
    { kana: 'バス', romaji: 'basu', alts: ['bus'] },
    { kana: 'テレビ', romaji: 'terebi', alts: [] },
    { kana: 'ナイフ', romaji: 'naifu', alts: ['knife'] },
    { kana: 'ドア', romaji: 'doa', alts: ['door'] },
    { kana: 'アニメ', romaji: 'anime', alts: [] },
    { kana: 'ゲーム', romaji: 'geemu', alts: ['game'] },
    { kana: 'コーヒー', romaji: 'koohii', alts: ['珈琲', 'coffee'] },
    { kana: 'ケーキ', romaji: 'keeki', alts: ['cake'] },
    { kana: 'ピザ', romaji: 'piza', alts: ['pizza'] },
    { kana: 'ゾンビ', romaji: 'zonbi', alts: ['zombie'] },
    { kana: 'ホラー', romaji: 'horaa', alts: ['horror'] },
    { kana: 'チョコ', romaji: 'choko', alts: [] }
  ],
  // First entry is the ヤバい zombie used for most spawns and YABAI Rush
  YABAI_EXCLAMATIONS: [
    { kana: 'ヤバい', romaji: 'yabai', alts: ['やばい', 'yabay'] }, // "oh no!" / "crazy!"
    { kana: 'こわい', romaji: 'kowai', alts: ['怖い', '恐い'] },     // "scary!"
    { kana: 'たすけて', romaji: 'tasukete', alts: ['助けて'] },      // "help!"
    { kana: 'にげろ', romaji: 'nigero', alts: ['逃げろ'] },          // "run!"
    { kana: 'なに', romaji: 'nani', alts: ['何'] },                  // "what?!"
    { kana: 'うそ', romaji: 'uso', alts: ['嘘'] },                   // "no way!"
    { kana: 'まじで', romaji: 'majide', alts: ['マジで', '本気で'] }, // "seriously?!"
    { kana: 'くるな', romaji: 'kuruna', alts: ['来るな'] },          // "stay back!"
    { kana: 'やめて', romaji: 'yamete', alts: ['止めて'] },          // "stop!"
    { kana: 'まって', romaji: 'matte', alts: ['待って'] },           // "wait!"
    { kana: 'ばけもの', romaji: 'bakemono', alts: ['化け物', '化物'] }, // "monster!"
    // Seeing them
    { kana: 'ゾンビだ', romaji: 'zonbi da', alts: ['ぞんびだ'] },             // "it's a zombie!"
    { kana: 'うごいた', romaji: 'ugoita', alts: ['動いた'] },               // "it moved!"
    { kana: 'いきてる', romaji: 'ikiteru', alts: ['生きてる'] },          // "it's alive!"
    { kana: 'くるぞ', romaji: 'kuru zo', alts: ['来るぞ'] },              // "here they come!"
    { kana: 'きもい', romaji: 'kimoi', alts: ['キモい', 'キモイ'] },         // "gross!"
    { kana: 'くさい', romaji: 'kusai', alts: ['臭い'] },                // "it stinks!"
    // Panicking
    { kana: 'まずい', romaji: 'mazui', alts: ['不味い'] },              // "this is bad!"
    { kana: 'いやだ', romaji: 'iya da', alts: ['嫌だ'] },               // "no, no, no!"
    { kana: 'まじかよ', romaji: 'maji ka yo', alts: ['マジかよ'] },      // "you've got to be kidding!"
    { kana: 'だれか', romaji: 'dareka', alts: ['誰か'] },               // "somebody!"
    { kana: 'はやく', romaji: 'hayaku', alts: ['早く', '速く'] },         // "hurry!"
    { kana: 'かくれろ', romaji: 'kakurero', alts: ['隠れろ'] },          // "hide!"
    { kana: 'かまれた', romaji: 'kamareta', alts: ['噛まれた'] },        // "I got bitten!"
    { kana: 'しぬ', romaji: 'shinu', alts: ['死ぬ'] },                  // "I'm gonna die!"
    { kana: 'おわった', romaji: 'owatta', alts: ['終わった'] },          // "we're done for!"
    // Fighting back
    { kana: 'たたかえ', romaji: 'tatakae', alts: ['戦え', '闘え'] },      // "fight!"
    { kana: 'ちくしょう', romaji: 'chikushou', alts: ['畜生', 'ちきしょう'] }, // "damn it!"
    { kana: 'だいじょうぶ', romaji: 'daijoubu', alts: ['大丈夫'] }      // "are you okay?!"
  ],
  BOSS_PHRASES: [
    { kana: 'たすけてください', romaji: 'tasukete kudasai', alts: ['助けてください', '助けて下さい'] }, // "please help me!"
    { kana: 'ゾンビをたおせ', romaji: 'zonbi o taose', alts: ['ゾンビを倒せ', 'zombie o taose'] },     // "take down the zombies!"
    { kana: 'あたまをねらえ', romaji: 'atama o nerae', alts: ['頭を狙え', '頭をねらえ', 'あたまを狙え'] }, // "aim for the head!"
    { kana: 'にげられない', romaji: 'nigerarenai', alts: ['逃げられない'] },                            // "there's no escape!"
    { kana: 'こっちにくるな', romaji: 'kocchi ni kuruna', alts: ['こっちに来るな', 'こっち来るな', 'こっちくるな'] }, // "get away from me!"
    { kana: 'もうだめだ', romaji: 'mou dame da', alts: ['もう駄目だ'] },                                 // "it's hopeless!"
    { kana: 'ヤバいヤバいヤバい', romaji: 'yabai yabai yabai', alts: [] }
  ],
  // YABAI mode for non-Japanese speakers: English lines straight out of zombie movies, no translation.
  // First entry is the rush zombie, like ヤバい above.
  YABAI_EN: [
    { kana: 'ZOMBIES!', romaji: '', alts: ['zombie', 'zombi'] },
    { kana: 'OH NO!', romaji: '', alts: ['oh no no', 'ono', 'oh now'] },
    { kana: 'RUN!', romaji: '', alts: ['run run'] },
    { kana: 'HELP!', romaji: '', alts: ['help me'] },
    { kana: 'THEY’RE COMING!', romaji: '', alts: ['they are coming', 'their coming'] },
    { kana: 'BEHIND YOU!', romaji: '', alts: [] },
    { kana: 'LOOK OUT!', romaji: '', alts: [] },
    { kana: 'AIM FOR THE HEAD!', romaji: '', alts: ['go for the head'] },
    { kana: 'SHOOT IT!', romaji: '', alts: ['shoot'] },
    { kana: 'HEADSHOT!', romaji: '', alts: ['head shot'] },
    { kana: 'DOUBLE TAP!', romaji: '', alts: [] },
    { kana: 'RELOAD!', romaji: '', alts: ['reloading'] },
    { kana: 'I’M OUT OF AMMO!', romaji: '', alts: ['i am out of ammo', 'out of ammo'] },
    { kana: 'LOCK THE DOOR!', romaji: '', alts: ['lock the doors'] },
    { kana: 'GET TO THE CAR!', romaji: '', alts: [] },
    { kana: 'GET TO THE ROOF!', romaji: '', alts: [] },
    { kana: 'DON’T GO IN THERE!', romaji: '', alts: ['do not go in there'] },
    { kana: 'LET’S SPLIT UP!', romaji: '', alts: ['lets split up', 'split up'] },
    { kana: 'STAY QUIET!', romaji: '', alts: [] },
    { kana: 'KEEP MOVING!', romaji: '', alts: [] },
    { kana: 'GO GO GO!', romaji: '', alts: [] },
    { kana: 'WE HAVE TO GO!', romaji: '', alts: ['we got to go', 'we gotta go'] },
    { kana: 'THERE’S TOO MANY!', romaji: '', alts: ['there are too many', 'there is too many', 'too many'] },
    { kana: 'THEY’RE EVERYWHERE!', romaji: '', alts: ['they are everywhere'] },
    { kana: 'WE’RE NOT SAFE HERE!', romaji: '', alts: ['we are not safe here'] },
    { kana: 'IS IT DEAD?!', romaji: '', alts: [] },
    { kana: 'IT’S NOT HIM ANYMORE!', romaji: '', alts: ['it is not him anymore', 'that is not him anymore', 'that’s not him anymore'] },
    { kana: 'I GOT BIT!', romaji: '', alts: ['i got bitten', 'i’ve been bitten'] },
    { kana: 'IT’S JUST A SCRATCH!', romaji: '', alts: ['it is just a scratch', 'just a scratch'] },
    { kana: 'DON’T LET THEM BITE YOU!', romaji: '', alts: ['do not let them bite you'] }
  ]
};

let currentKanaMode = 'H_BASIC';

function isEnglishMode() { return currentKanaMode === 'YABAI_EN'; }
function isYabaiMode() { return currentKanaMode === 'YABAI' || currentKanaMode === 'YABAI_EN'; }
function yabaiBank() { return isEnglishMode() ? KANA_BANKS.YABAI_EN : KANA_BANKS.YABAI_EXCLAMATIONS; }
function yabaiItem() { return yabaiBank()[0]; }

function setKanaMode(mode) {
  currentKanaMode = mode;
  const buttons = {
    H_BASIC: 'btn-mode-h-basic', H_WORDS: 'btn-mode-h-words', K_BASIC: 'btn-mode-k-basic',
    K_WORDS: 'btn-mode-k-words', MIXED: 'btn-mode-mixed', YABAI: 'btn-mode-yabai', YABAI_EN: 'btn-mode-yabai-en'
  };
  Object.keys(buttons).forEach(m => {
    const btn = $(buttons[m]);
    const active = m === mode;
    if (m === 'YABAI' || m === 'YABAI_EN') {
      btn.className = active
        ? 'py-2 px-1 rounded border border-yellow-300 bg-yellow-500 text-black font-bold transition-all shadow-lg'
        : 'py-2 px-1 rounded border border-yellow-700 bg-yellow-950 text-yellow-300 transition-all opacity-80';
    } else {
      btn.className = 'py-2 px-1 rounded border transition-all ' + (active ? 'btn-mode-active' : 'btn-mode-inactive');
    }
    btn.setAttribute('aria-pressed', active);
  });
  updateEngineNote();
}
