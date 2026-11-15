// Campaign data: 7 chapters x 3 battles, enemy decks and short history texts (Armenian).
// Battle n-1 -> Easy, n-2 -> Medium, n-3 (boss) -> Hard.

const LEVEL_BY_INDEX = ['easy', 'medium', 'hard'];
// Difficulty ramp (v1.2): the same three algorithms in every chapter, but with a growing search budget.
// Hard (MCTS) thinking time per chapter in ms (also capped by the player's setting) and Medium (Minimax) depth.
const HARD_MS_BY_CHAPTER = [400, 700, 1000, 1500, 2000, 3000, 5000];
const MEDIUM_DEPTH_BY_CHAPTER = [2, 2, 3, 3, 3, 3, 3];

function chapter(id, titleHy, periodHy, legend, introHy, heroUnlock, signature, battles) {
  return {
    id, titleHy, periodHy, legend, introHy, heroUnlock, signature,
    battles: battles.map((b, i) => ({
      id: `${id}-${i + 1}`, chapter: id, index: i + 1,
      titleHy: b.titleHy, introHy: b.introHy,
      aiLevel: LEVEL_BY_INDEX[i], aiDeck: b.deck,
      aiTimeMs: i === 2 ? HARD_MS_BY_CHAPTER[id - 1] : undefined,
      aiMaxDepth: i === 1 ? MEDIUM_DEPTH_BY_CHAPTER[id - 1] : undefined,
      bossId: i === 2 ? b.deck.find(c => c.startsWith('boss_')) : undefined,
      tutorial: !!b.tutorial,
      seed: id * 100 + i + 1,
    })),
  };
}

export const CHAPTERS = [
  chapter(1, 'Հայկ Նահապետ', 'Ավանդական ժամանակներ', true,
    'Ըստ ավանդության, որը V դարում գրի է առել Մովսես Խորենացին, Հայկ Նահապետը չհնազանդվեց Բաբելոնի տիրակալ Բելին և իր տոհմով հեռացավ դեպի Արարատի երկիր։ Բելը զորքով հետապնդեց նրան, և Հայոց ձորում տեղի ունեցավ ճակատամարտ։ Սա ազգային ավանդազրույց է, ոչ թե փաստագրված պատմություն։',
    'hayk', 'giant', [
      { titleHy: 'Ճանապարհ դեպի հյուսիս', tutorial: true,
        introHy: 'Ըստ ավանդության՝ Հայկը լքում է Բաբելոնը։ Բելի առաջապահ ջոկատը փորձում է փակել ճանապարհը։ Այս մարտը նաև ուսուցողական է. հետևիր հուշումներին։',
        deck: ['spearman', 'spearman', 'spearman', 'slinger', 'slinger', 'slinger', 'archer', 'giant'] },
      { titleHy: 'Վանա լճի ափին',
        introHy: 'Ըստ ավանդության՝ Բելի զորքը հասնում է Վանա լճի շրջակայք։ Հակառակորդի շարքերում հայտնվում են հսկաներ։',
        deck: ['spearman', 'spearman', 'archer', 'archer', 'slinger', 'cavalry', 'giant', 'giant'] },
      { titleHy: 'Հայոց ձորի ճակատամարտը',
        introHy: 'Ըստ ավանդության՝ վճռական մարտում Հայկն իր լայնալիճ աղեղով խոցում է Բելին։ Հաղթիր Բելին և բացիր «Հայկ Նահապետ» քարտը։',
        deck: ['spearman', 'spearman', 'archer', 'archer', 'cavalry', 'giant', 'giant', 'boss_bel'] },
    ]),
  chapter(2, 'Արտաշես I', 'մ.թ.ա. II դար', false,
    'Մ.թ.ա. 190 թ. Մագնեսիայի ճակատամարտում Սելևկյան տերությունը պարտվեց Հռոմին։ Օգտվելով դրանից՝ Արտաշեսը մ.թ.ա. 189 թ. Մեծ Հայքը հռչակեց անկախ և հիմնեց Արտաշեսյան արքայատոհմը։ Նա միավորեց հայկական հողերը և Արաքսի ափին կառուցեց Արտաշատ մայրաքաղաքը։',
    'artashes', 'elephant', [
      { titleHy: 'Անկախության հռչակումը',
        introHy: 'Սելևկյան կայազորները դեռ մնում են երկրում։ Պետք է դուրս մղել նրանց։',
        deck: ['spearman', 'spearman', 'archer', 'slinger', 'cavalry', 'cavalry', 'shieldbearer', 'elephant'] },
      { titleHy: 'Հողերի միավորումը',
        introHy: 'Արտաշեսը միավորում է հայկական երկրամասերը։ Հակառակորդը մարտի է նետում մարտական փղեր։',
        deck: ['spearman', 'spearman', 'archer', 'archer', 'cavalry', 'shieldbearer', 'elephant', 'elephant'] },
      { titleHy: 'Սելևկյան զորավարի դեմ',
        introHy: 'Սելևկյանները փորձում են վերականգնել իրենց իշխանությունը։ Հաղթիր զորավարին և բացիր «Արտաշես I» քարտը։',
        deck: ['spearman', 'archer', 'archer', 'shieldbearer', 'cavalry', 'elephant', 'elephant', 'boss_seleucid'] },
    ]),
  chapter(3, 'Տիգրան Մեծ', 'մ.թ.ա. I դար', false,
    'Տիգրան II Մեծի օրոք (մ.թ.ա. 95–55) Հայաստանը դարձավ Առաջավոր Ասիայի հզորագույն տերություններից մեկը։ Մ.թ.ա. 69 թ. հռոմեացի զորավար Լուկուլլոսը ներխուժեց Հայաստան և պաշարեց Տիգրանակերտը։ Պատմական ճակատամարտում հայկական զորքը պարտվեց, սակայն Հռոմը չկարողացավ նվաճել երկիրը. խաղում դու կարող ես փորձել այլ ելք։',
    'tigran', 'legionary', [
      { titleHy: 'Հռոմեական առաջապահը',
        introHy: 'Հռոմեական լեգեոններն անցնում են Եփրատը։ Լեգեոներները լավ պաշտպանված են նետերից. նրանց դեմ պետք է մերձամարտ։',
        deck: ['legionary', 'legionary', 'legionary', 'archer', 'archer', 'slinger', 'cavalry', 'spearman'] },
      { titleHy: 'Տիգրանակերտի մատույցներում',
        introHy: 'Հռոմեացիները մոտենում են մայրաքաղաքին։ Նրանց զորքը կարգապահ է և լավ զինված։',
        deck: ['legionary', 'legionary', 'legionary', 'archer', 'archer', 'cavalry', 'cavalry', 'vahagn'] },
      { titleHy: 'Տիգրանակերտի ճակատամարտը',
        introHy: 'Մ.թ.ա. 69 թ. հոկտեմբեր. Լուկուլլոսի բանակը կանգնած է Տիգրանակերտի պարիսպների մոտ։ Հաղթիր Լուկուլլոսին և բացիր «Տիգրան Մեծ» քարտը։',
        deck: ['legionary', 'legionary', 'legionary', 'archer', 'archer', 'cavalry', 'cataphract', 'boss_lucullus'] },
    ]),
  chapter(4, 'Ավարայր, 451', 'V դար', false,
    'V դարի կեսին Սասանյան արքա Հազկերտ II-ը պահանջեց, որ հայերը հրաժարվեն քրիստոնեությունից։ 449 թ. Արտաշատի ժողովը մերժեց պահանջը, և 451 թ. մայիսի 26-ին Ավարայրի դաշտում սպարապետ Վարդան Մամիկոնյանի զորքը մարտնչեց թվով գերազանցող պարսից բանակի դեմ։ Վարդանը զոհվեց, բայց պայքարը շարունակվեց, և 484 թ. Նվարսակի պայմանագրով հայերը պահպանեցին իրենց հավատը։',
    'vardan', 'immortal', [
      { titleHy: 'Արտաշատի ժողովից հետո',
        introHy: 'Պարսից առաջին ջոկատները մտնում են երկիր։ «Անմահները» մեկ անգամ վերադառնում են մարտի՝ պատրաստ եղիր դրան։',
        deck: ['immortal', 'immortal', 'spearman', 'spearman', 'archer', 'archer', 'cavalry', 'slinger'] },
      { titleHy: 'Տղմուտ գետի ափին',
        introHy: 'Երկու բանակները կանգնած են Տղմուտ գետի հանդիպակաց ափերին։ Պարսից զորքն ունի մարտական փղեր։',
        deck: ['immortal', 'immortal', 'immortal', 'archer', 'archer', 'cavalry', 'elephant', 'shieldbearer'] },
      { titleHy: 'Ավարայրի ճակատամարտը',
        introHy: '451 թ. մայիսի 26. վճռական մարտը։ Հաղթիր պարսից զորավարին և բացիր «Վարդան Մամիկոնյան» քարտը։',
        deck: ['immortal', 'immortal', 'immortal', 'archer', 'archer', 'elephant', 'cataphract', 'boss_persian'] },
    ]),
  chapter(5, 'Բագրատունիներ', 'IX–X դարեր', false,
    '885 թ. Աշոտ I Բագրատունին ճանաչվեց հայոց թագավոր. շուրջ չորս դար անց վերականգնվեց հայկական թագավորությունը։ Նրա թոռը՝ Աշոտ II Երկաթը (914–928), տարիներ շարունակ պայքարեց Ատրպատականի ամիրա Յուսուֆի և այլ արաբական ամիրաների դեմ ու ամրապնդեց երկրի անկախությունը։ Այս գլուխը նվիրված է հենց Աշոտ Երկաթի պայքարին։',
    'ashot', 'camelrider', [
      { titleHy: 'Ասպատակություն',
        introHy: 'Ամիրայի արագաշարժ ջոկատներն ասպատակում են գավառները։ Ուղտավոր հեծյալները շատ արագ են՝ պաշտպանիր աշտարակներդ։',
        deck: ['camelrider', 'camelrider', 'spearman', 'spearman', 'archer', 'archer', 'slinger', 'cavalry'] },
      { titleHy: 'Սևանի ափին',
        introHy: 'Աշոտ Երկաթն ամրանում է Սևանա կղզում։ Հակառակորդը մեծ ուժերով մոտենում է լճի ափին։',
        deck: ['camelrider', 'camelrider', 'camelrider', 'cavalry', 'cavalry', 'archer', 'archer', 'horn'] },
      { titleHy: 'Ոստիկանի դեմ',
        introHy: 'Վճռական մարտ արաբ ոստիկանի զորքի դեմ։ Հաղթիր նրան և բացիր «Աշոտ Երկաթ» քարտը։',
        deck: ['camelrider', 'camelrider', 'camelrider', 'cavalry', 'cavalry', 'archer', 'archer', 'boss_ostikan'] },
    ]),
  chapter(6, 'Դավիթ Բեկ', 'XVIII դար', false,
    '1722 թ. Դավիթ Բեկը գլխավորեց Սյունիքի հայերի ազատագրական պայքարը և Կապանում ստեղծեց հայկական իշխանություն։ Լեռները և ամրոցները նրա գլխավոր դաշնակիցներն էին. 1727 թ. Հալիձորի բերդի մոտ սակավաթիվ պաշտպանները հաղթեցին օսմանյան մեծ զորքին։ Դավիթ Բեկի մահից հետո (1728) պայքարը շարունակեց Մխիթար Սպարապետը։',
    'davitbek', 'cannon', [
      { titleHy: 'Կապանի լեռներում',
        introHy: 'Հակառակորդը մտնում է Սյունիքի կիրճերը։ Նրա թնդանոթները կրակում են հեռվից, բայց անշարժ են։',
        deck: ['cannon', 'spearman', 'spearman', 'archer', 'archer', 'cavalry', 'shieldbearer', 'slinger'] },
      { titleHy: 'Ամրոցների պաշտպանությունը',
        introHy: 'Թշնամին պաշարում է լեռնային բերդերը։ Օգտագործիր սեփական աշտարակների մոտ կռվելու առավելությունը։',
        deck: ['cannon', 'cannon', 'spearman', 'spearman', 'archer', 'cavalry', 'cavalry', 'wall'] },
      { titleHy: 'Հալիձորի ճակատամարտը',
        introHy: '1727 թ. Հալիձորի բերդը պաշարված է։ Հաղթիր թշնամու զորավարին և բացիր «Դավիթ Բեկ» քարտը։',
        deck: ['cannon', 'cannon', 'cavalry', 'cavalry', 'archer', 'cataphract', 'shieldbearer', 'boss_warlord6'] },
    ]),
  chapter(7, 'Մայիսյան հերոսամարտեր, 1918', '1918 թ. մայիս', false,
    '1918 թ. մայիսին օսմանյան բանակը շարժվում էր դեպի Երևան և Արարատյան դաշտ։ Սարդարապատում, Բաշ Ապարանում և Ղարաքիլիսայում կանոնավոր զորամասերը և ժողովրդական աշխարհազորը միասին կանգնեցրին այդ առաջխաղացումը։ Դա ողջ ժողովրդի հավաքական պաշտպանությունն էր, որից հետո՝ մայիսի 28-ին, հռչակվեց Հայաստանի Հանրապետությունը։',
    'sardarapat', null, [
      { titleHy: 'Բաշ Ապարան',
        introHy: 'Մայիսի 23–29. հակառակորդը փորձում է հյուսիսից շրջանցել և դուրս գալ Երևանի վրա։ Ճանապարհը պետք է փակել։',
        deck: ['spearman', 'spearman', 'archer', 'archer', 'cavalry', 'cavalry', 'cannon', 'slinger'] },
      { titleHy: 'Ղարաքիլիսա',
        introHy: 'Մայիսի 25–28. ծանր, անհավասար մարտեր Ղարաքիլիսայի մոտ, որոնք կասեցրին հակառակորդի շարժումը։',
        deck: ['cavalry', 'cavalry', 'archer', 'archer', 'cannon', 'cannon', 'cataphract', 'vahagn'] },
      { titleHy: 'Սարդարապատ',
        introHy: 'Մայիսի 21–29. վճռական ճակատամարտը Սարդարապատի մոտ։ Հաղթիր և բացիր «Սարդարապատի զորախումբ» քարտը։',
        deck: ['cavalry', 'cavalry', 'archer', 'archer', 'cannon', 'cannon', 'cataphract', 'boss_warlord7'] },
    ]),
];

export const BATTLES = CHAPTERS.flatMap(c => c.battles);
export function getBattle(id) { return BATTLES.find(b => b.id === id); }
export function getChapter(id) { return CHAPTERS.find(c => c.id === id); }
export function nextBattleId(id) {
  const i = BATTLES.findIndex(b => b.id === id);
  return i >= 0 && i + 1 < BATTLES.length ? BATTLES[i + 1].id : null;
}

// AI deck presets for Free Battle and for self-play (--deckA / --deckB)
export const DECK_PRESETS = {
  starter: { nameHy: 'Սկզբնական կապուկ', cards: ['spearman', 'archer', 'slinger', 'cavalry', 'cataphract', 'shieldbearer', 'vahagn', 'ararat'] },
  cavalry: { nameHy: 'Հեծելազոր', cards: ['cavalry', 'cavalry', 'cavalry', 'cataphract', 'cataphract', 'spearman', 'horn', 'ararat'] },
  archers: { nameHy: 'Նետաձիգներ', cards: ['archer', 'archer', 'archer', 'slinger', 'shieldbearer', 'shieldbearer', 'archertower', 'vahagn'] },
  fortress: { nameHy: 'Ամրոց', cards: ['spearman', 'spearman', 'archer', 'archer', 'wall', 'archertower', 'cataphract', 'anahit'] },
  heroes: { nameHy: 'Հերոսներ', cards: ['tigran', 'hayk', 'spearman', 'spearman', 'archer', 'cavalry', 'shieldbearer', 'vahagn'] },
  ...Object.fromEntries(CHAPTERS.map(c => [`boss${c.id}`, { nameHy: `Գլուխ ${c.id}-ի բոսը`, cards: c.battles[2].aiDeck }])),
};
