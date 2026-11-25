// Chain Pop: this toy's own interface text in five languages (toy-specific, not a shared file).
// The text every toy shares (names for the More menu, Share, About) lives in i18n.ts.

const en = {
  desc_pop: "A sheet of parcel bubble wrap. Pop the cells one by one, or pop five fast and wring the whole sheet. One bubble per sheet refuses to pop. A tiny stress-relief toy, no sign-up.",
  hint_pop: "Pop the bubble wrap · 5 fast pops, then wring it",
  pop_armed: "Tap anywhere to wring the whole sheet",
  pop_wring: "WRING IT!",
  pop_last: "One left. Of course.",
  pop_dud_done: "Finally.",
  pop_sheet: "Sheet {n}",
  pop_fragile: "FRAGILE",
  share_pop: "📦 A sheet of bubble wrap that never runs out. Go on:",
  share_pop_stat: "📦 I popped {n} bubbles in one wring. Your turn:",
}

const zhCN: typeof en = {
  desc_pop: "一张快递泡泡纸。一个一个捏，或者连捏 5 个后整张拧爆。每张都有一个怎么也捏不破的。打开即玩的解压小玩具。",
  hint_pop: "捏泡泡纸 · 连捏 5 个，整张拧爆",
  pop_armed: "点任意处，整张拧爆",
  pop_wring: "拧它！",
  pop_last: "还剩一个。果然。",
  pop_dud_done: "终于。",
  pop_sheet: "第 {n} 张",
  pop_fragile: "易碎",
  share_pop: "📦 一张捏不完的泡泡纸，来捏：",
  share_pop_stat: "📦 我一把拧爆了 {n} 个泡泡，你也来：",
}

const es: typeof en = {
  desc_pop: "Una hoja de plástico de burbujas de paquete. Explótalas una a una, o cinco seguidas y retuerce la hoja entera. En cada hoja hay una que se resiste. Un juguete antiestrés, sin registro.",
  hint_pop: "Explota el plástico de burbujas · 5 rápidas y retuércelo",
  pop_armed: "Toca donde quieras para retorcer la hoja",
  pop_wring: "¡RETUÉRCELO!",
  pop_last: "Queda una. Cómo no.",
  pop_dud_done: "Por fin.",
  pop_sheet: "Hoja {n}",
  pop_fragile: "FRÁGIL",
  share_pop: "📦 Plástico de burbujas que nunca se acaba. Dale:",
  share_pop_stat: "📦 He reventado {n} burbujas de un solo retorcijón. Te toca:",
}

const fr: typeof en = {
  desc_pop: "Une feuille de papier bulle de colis. Éclate les bulles une à une, ou cinq d’affilée puis tords toute la feuille. Sur chaque feuille, une bulle refuse d’éclater. Un petit jouet anti-stress, sans inscription.",
  hint_pop: "Éclate le papier bulle · 5 d’affilée, puis tords-le",
  pop_armed: "Touche n’importe où pour tordre la feuille",
  pop_wring: "TORDS-LE !",
  pop_last: "Il en reste une. Évidemment.",
  pop_dud_done: "Enfin.",
  pop_sheet: "Feuille {n}",
  pop_fragile: "FRAGILE",
  share_pop: "📦 Du papier bulle qui ne finit jamais. Vas-y :",
  share_pop_stat: "📦 J’ai éclaté {n} bulles d’une seule torsion. À toi :",
}

const ja: typeof en = {
  desc_pop: "荷物のプチプチが 1 枚。ひとつずつつぶすもよし、5 連続でつぶして雑巾しぼりで一気にいくもよし。どのシートにも、なぜかつぶれない 1 個がある。登録不要のストレス解消トイ。",
  hint_pop: "プチプチをつぶそう · 5 連続で雑巾しぼり",
  pop_armed: "タップで一気に雑巾しぼり",
  pop_wring: "雑巾しぼり！",
  pop_last: "ひとつ残った。やっぱり。",
  pop_dud_done: "やっと。",
  pop_sheet: "{n} 枚目",
  pop_fragile: "ワレモノ",
  share_pop: "📦 無限プチプチ。どうぞ：",
  share_pop_stat: "📦 雑巾しぼり一発で {n} 個つぶした。次はきみの番：",
}

export default { en, 'zh-CN': zhCN, es, fr, ja }
