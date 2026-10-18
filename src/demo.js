/* ============================================================
   DEMO WORKSPACE — realistic sample data to explore features
   ============================================================ */
function demoWorkspace(base) {
  const s = clone(base); s.trades = []; s.plans = []; s.transactions = []; s.journals = []; s.notebooks = (s.notebooks || []).filter(n => n.folderId === PA_NOTE_FOLDER.id);
  let z = 9137; const rnd = () => ((z = (z * 16807) % 2147483647) - 1) / 2147483646;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const t0 = now();
  const main = { id: uid('acc'), name: L('บัญชีหลัก', 'Main account'), broker: 'IC Markets', accountType: 'Personal', startingCapital: 25000, currency: 'USD', active: true, createdAt: t0, objective: { enabled: false, profitTargetPct: 10, maxDailyLossPct: 5, maxDrawdownPct: 10, ddMode: 'static', minTradingDays: 0 } };
  const prop = { id: uid('acc'), name: 'Prop Challenge 100K', broker: 'FTMO', accountType: 'Prop Evaluation', startingCapital: 100000, currency: 'USD', active: true, createdAt: t0, objective: { enabled: true, profitTargetPct: 10, maxDailyLossPct: 5, maxDrawdownPct: 10, ddMode: 'static', minTradingDays: 4 } };
  s.accounts = [main, prop]; s.settings.defaultAccount = main.id;
  for (const i of s.instruments) if (['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'USTECH', 'BTCUSD'].includes(i.symbol)) i.commissionPerLot = i.symbol === 'XAUUSD' || i.assetClass === 'Forex' ? 7 : 1.2;
  const insts = { EURUSD: [1.0850, .0018], GBPUSD: [1.2700, .0022], USDJPY: [151.20, .25], XAUUSD: [2650, 6], USTECH: [21000, 40], BTCUSD: [64000, 450] };
  const syms = Object.keys(insts), weights = { EURUSD: 3, GBPUSD: 2, USDJPY: 1, XAUUSD: 4, USTECH: 2, BTCUSD: 1 };
  const pool = syms.flatMap(k => Array(weights[k]).fill(k));
  const today = new Date(); today.setUTCHours(0, 0, 0, 0); let counter = 0; const drift = {}; syms.forEach(k => drift[k] = insts[k][0]);
  const pbMix = [['pb_pullback', .34], ['pb_retest', .58], ['pb_failbo', .76], ['pb_rejection', .88], ['pb_range', .95], ['pb_double', 1]];
  const notesWin = ['รอราคาย่อมาที่โซนแล้วค่อยเข้า ทำตามแผนครบ', 'เข้าตามสัญญาณยืนยัน ถือจนถึงเป้า ไม่แทรกแซง', 'โครงสร้างชัด เป้าหมายสมเหตุสมผล บริหารออเดอร์ได้ดี', 'เลื่อนระดับ Stop ไปบังทุนหลังได้ 1R ตามกฎ'];
  const notesLoss = ['เข้าเร็วไปก่อนแท่งยืนยันปิด', 'ราคาวิ่งผ่านโซนไม่มีปฏิกิริยา ควรรอให้ชัดกว่านี้', 'เทรดสวนเทรนด์ใหญ่ H4', 'ข่าวออกระหว่างถือ ควรหลีกเลี่ยงช่วงข่าวแรง'];
  for (let d = 130; d >= 0; d--) {
    const day = new Date(+today - d * 86400000), wd = day.getUTCDay(); if (wd === 0 || wd === 6) continue;
    if (rnd() < .12) continue;
    const nTr = rnd() < .5 ? 1 : rnd() < .75 ? 2 : rnd() < .9 ? 3 : 4; let dayLosses = 0;
    for (let k = 0; k < nTr; k++) {
      const sym = pick(pool), ins = s.instruments.find(i => i.symbol === sym); if (!ins) continue;
      drift[sym] *= 1 + (rnd() - .48) * .012; const [, dist0] = insts[sym];
      const dist = +(dist0 * (.7 + rnd() * .7)).toFixed(ins.decimals), entry = +drift[sym].toFixed(ins.decimals);
      const u = rnd(), pb = pbMix.find(x => u < x[1])[0], side = rnd() < .54 ? 'Buy' : 'Sell', sign = side === 'Buy' ? 1 : -1;
      const checklist = (s.playbooks.find(p => p.id === pb)?.ruleGroups || []).flatMap(g => g.items || []).map(() => ({ checked: false })); /* only drives the sample discipline mix */ const compliance = rnd() < .7 ? 1 : .4 + rnd() * .5;
      checklist.forEach(r => r.checked = rnd() < compliance);
      const comp = checklist.filter(r => r.checked).length / (checklist.length || 1);
      const emo = dayLosses >= 2 ? pick(['FOMO', 'Fear', 'FOMO', 'Greed']) : comp >= .99 ? pick(['Calm', 'Confident', 'Calm', 'Confident', 'Neutral']) : pick(['Hesitant', 'FOMO', 'Neutral', 'Greed', 'Bored']);
      const bad = ['FOMO', 'Greed', 'Bored'].includes(emo);
      const pWin = .31 + comp * .17 - (bad ? .13 : 0) + (pb === 'pb_pullback' ? .03 : 0) + (sym === 'BTCUSD' ? -.06 : 0);
      const isBE = rnd() < .06, win = !isBE && rnd() < pWin;
      let r = isBE ? 0 : win ? .5 + rnd() * (rnd() < .25 ? 3.2 : 1.9) : -(rnd() < (bad ? .35 : .12) ? 1.2 + rnd() * .6 : .65 + rnd() * .4);
      const acct = counter % 4 === 3 ? prop : main, riskPct = acct === prop ? .5 : (bad ? 1.4 : .8 + rnd() * .3);
      const bal = acct.startingCapital * (1 + (counter / 1000));
      const perUnit = dist / ins.tickSize * ins.tickValue / (ins.quoteCurrency === 'JPY' ? entry : 1); let qty = Math.floor(bal * riskPct / 100 / perUnit / ins.quantityStep) * ins.quantityStep; qty = +Math.max(ins.minQuantity, qty).toFixed(2);
      const hour = 7 + Math.floor(rnd() * 11), min = Math.floor(rnd() * 60);
      const et = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, min));
      if (+et > Date.now()) continue;
      const durMin = win ? 25 + rnd() * 280 : 8 + rnd() * 120;
      const exitPrice = +(entry + sign * dist * r).toFixed(ins.decimals);
      const mfe = +(entry + sign * dist * Math.max(r, 0) * (1 + rnd() * .6) + sign * dist * (win ? 0 : rnd() * .8)).toFixed(ins.decimals);
      const mae = +(entry - sign * dist * (win ? rnd() * .7 : Math.min(1, -r + rnd() * .05))).toFixed(ins.decimals);
      const tags = [];
      if (!win && !isBE && (bad || comp < .99) && rnd() < .75) tags.push(dayLosses >= 2 && emo === 'FOMO' ? 'tag_m6' : emo === 'FOMO' ? 'tag_m5' : pick(['tag_m0', 'tag_m1', 'tag_m2', 'tag_m3', 'tag_m4', 'tag_m7']));
      else if (win && rnd() < .04) { tags.push('tag_m2'); r = Math.min(r, .8); }
      if (rnd() < .5) tags.push(pick(['tag_c0', 'tag_c1', 'tag_c2', 'tag_c3']));
      const commission = sym === 'XAUUSD' || ins.assetClass === 'Forex' ? +(qty * 7).toFixed(2) : +(qty * 1.2).toFixed(2);
      const swap = durMin > 240 && rnd() < .4 ? -+(qty * 2.1).toFixed(2) : 0;
      const t = { id: uid('trd'), displayId: '', timeframe: ['M15', 'H1', 'M5', 'M15', 'H4'][(d + k) % 5], accountId: acct.id, entryDateTime: et.toISOString(), exitDateTime: new Date(+et + durMin * 60000).toISOString(), instrumentId: ins.id, symbol: sym, playbookId: pb, side, quantity: qty, entryPrice: entry, stopLoss: +(entry - sign * dist).toFixed(ins.decimals), takeProfit: +(entry + sign * dist * (['pb_failbo', 'pb_double'].includes(pb) ? 3 : 2.2)).toFixed(ins.decimals), exitPrice, mae, mfe, commission, swap, status: 'Closed', tags, emotion: emo, rating: win ? (comp >= .99 ? 5 : 4) : comp >= .99 ? (isBE ? 4 : 3) : bad ? 1 : 2, reviewed: (rnd(), rnd() < .7), note: win ? pick(notesWin) : isBE ? 'บังทุนแล้วโดนกิน — ยอมรับได้' : pick(notesLoss), images: [], fxRate: 1, createdAt: t0, updatedAt: t0 };
      if (sym === 'USDJPY') t.fxRate = +(1 / exitPrice).toFixed(6);
      t.displayId = displayId(s.trades, t.entryDateTime); s.trades.push(t); counter++; if (r < 0) dayLosses++;
    }
    if (rnd() < .65) {
      const k = day.toISOString().slice(0, 10);
      s.journals.push({ id: uid('jr'), date: k, premarket: pick(['โฟกัส XAUUSD ช่วงลอนดอน รอราคาย่อเข้าโซน demand 4H', 'ข่าว CPI คืนนี้ — เทรดเฉพาะช่วงเช้า ลดขนาดสัญญาครึ่งหนึ่ง', 'ตลาด range ชัด เน้นเล่นขอบกรอบ ไม่ไล่ราคา', 'EURUSD ทำ higher low บน H1 มองหา long เท่านั้น']), review: pick(['ทำตามแผนได้ดี รอจังหวะ ไม่ฝืนเทรด', 'ใจร้อนไป 1 ไม้ ต้องรอแท่งยืนยัน', 'หยุดเทรดหลังแพ้ 2 ไม้ตามกฎ ดีมาก', 'วันที่ดี บริหารออเดอร์ได้ตามแผน']), lessons: pick(['ความอดทนคือ edge', 'อย่าเพิ่มขนาดหลังแพ้', 'จดโซนก่อนตลาดเปิดเสมอ', '']), mood: 1 + Math.floor(rnd() * 5), focus: 2 + Math.floor(rnd() * 4), followedPlan: rnd() < .75, images: [], createdAt: t0, updatedAt: t0 });
    }
  }
  // one open trade
  const o = clone(s.trades[s.trades.length - 1]); Object.assign(o, { id: uid('trd'), entryDateTime: now(), exitDateTime: '', exitPrice: null, status: 'Open', note: 'รอราคาวิ่งไปเป้าแรก', reviewed: false, mae: null, mfe: null, emotion: 'Calm', rating: null }); o.displayId = displayId(s.trades, o.entryDateTime); s.trades.push(o);
  s.transactions.push({ id: uid('txn'), accountId: main.id, dateTime: new Date(+today - 70 * 86400000).toISOString(), type: 'Deposit', amount: 2500, note: 'เติมทุน', createdAt: t0 });
  s.transactions.push({ id: uid('txn'), accountId: main.id, dateTime: new Date(+today - 20 * 86400000).toISOString(), type: 'Withdrawal', amount: 1500, note: 'ถอนกำไร', createdAt: t0 });
  // a few setups that were seen but not taken
  const closedT = s.trades.filter(t => t.status === 'Closed');
  [5, 17, 33, 50].forEach((k, n) => { const src = closedT[closedT.length - k]; if (!src) return; const m = clone(src); Object.assign(m, { id: uid('trd'), status: 'Missed', quantity: null, commission: 0, swap: 0, mae: null, mfe: null, rating: null, reviewed: true, tags: m.tags.filter(x => !String(x).startsWith('tag_m')), emotion: ['Hesitant', 'Fear', 'Hesitant', 'Bored'][n], note: ['ลังเลจนราคาวิ่งไปก่อน ไม่ได้เข้า', 'กลัวหลังแพ้ไม้ก่อน เลยปล่อยผ่าน', 'Limit ไม่ได้ไม้ ราคาไม่ย่อถึง', 'ไม่ได้อยู่หน้าจอช่วงนั้น'][n] }); m.entryDateTime = new Date(+new Date(src.entryDateTime) + 45 * 60000).toISOString(); m.exitDateTime = ''; m.displayId = displayId(s.trades, m.entryDateTime); s.trades.push(m); });
  s.notebooks.push({ id: uid('note'), folderId: 'nbf_general', title: 'กฎเหล็กของฉัน', html: '<h2>กฎเหล็ก 5 ข้อ</h2><ol><li>เสี่ยงไม่เกิน 1% ต่อไม้</li><li>แพ้ 2 ไม้ติด = หยุดเทรดวันนั้น</li><li>ไม่เทรดก่อน/หลังข่าวแรง 15 นาที</li><li>ทุกไม้ต้องมีระดับ Stop ก่อนกดเข้า</li><li>บันทึกและรีวิวทุกเทรดภายในวันเดียวกัน</li></ol>', pinned: true, createdAt: t0, updatedAt: t0 });
  s.notebooks.push({ id: uid('note'), folderId: 'nbf_general', title: 'รีวิวประจำสัปดาห์', html: NOTE_TEMPLATES.find(x => x.id === 'weekly').html, createdAt: t0, updatedAt: t0 });
  s.notebooks.push(...s.journals.map(j => { const n = journalToNote(j); n.strategyIds = []; return n; })); delete s.journals; delete s.plans;
  s.meta.onboarded = true; s.meta.demo = true; return s;
}
const NOTE_TEMPLATES = [
  { id: 'journal', icon: 'journal-day', title: 'Daily Journal · บันทึกประจำวัน', desc: 'แผนก่อนตลาดเปิด สถานการณ์ และรีวิวหลังเซสชัน', html: '<h2>แผนก่อนตลาดเปิด</h2><ul><li>ข่าวสำคัญ: </li><li>Bias (HTF): </li><li>ระดับราคา (PDH / PDL / Asia / DO): </li></ul><h3>สถานการณ์หลัก</h3><p>ถ้า … → …</p><h3>สถานการณ์สำรอง</h3><p><br></p><h2>รีวิวหลังเซสชัน</h2><h3>สิ่งที่ทำได้ดี</h3><p><br></p><h3>สิ่งที่ต้องปรับ</h3><p><br></p><h2>บทเรียน</h2><p><br></p>' },
  { id: 'strategy', icon: 'playbooks', title: 'Strategy spec · คู่มือ Strategy', desc: 'แนวคิด เงื่อนไข ราคาเข้า ระดับ Stop ระดับเป้าหมาย และความผิดพลาดที่พบบ่อย', html: '<h2>แนวคิด</h2><p><br></p><h2>ใช้เมื่อ</h2><ul><li><br></li></ul><h2>ห้ามใช้เมื่อ</h2><ul><li><br></li></ul><h2>ขั้นตอน</h2><ol><li><br></li></ol><h2>Entry price · Stop level · Target level</h2><ul><li>Entry price: </li><li>Stop level: </li><li>Target level 1 / Target level 2: </li></ul><h2>การบริหารไม้</h2><p><br></p><h2>Invalidation</h2><ul><li>Setup: </li><li>Trade: </li><li>Bias: </li></ul><h2>ความผิดพลาดที่พบบ่อย</h2><ul><li><br></li></ul><h2>สิ่งที่วัดใน Journal</h2><ul><li><br></li></ul>' },
  { id: 'daily', icon: 'calendar', title: 'Daily Review · รีวิวรายวัน', desc: 'บริบทตลาด การเข้าออก และบทเรียนของวัน', html: '<h2>รีวิวรายวัน</h2><h3>บริบทตลาด</h3><p><br></p><h3>การเทรดวันนี้</h3><ul><li><br></li></ul><h3>สิ่งที่ทำได้ดี</h3><p><br></p><h3>สิ่งที่ต้องปรับ</h3><p><br></p><h3>บทเรียน</h3><p><br></p>' },
  { id: 'trade', icon: 'trades', title: 'Trade Review · รีวิวเทรด', desc: 'วิเคราะห์ไม้เดียวแบบละเอียด', html: '<h2>รีวิวเทรด</h2><h3>Setup</h3><p><br></p><h3>เหตุผลที่เข้า</h3><p><br></p><h3>การบริหารออเดอร์</h3><p><br></p><h3>ผลลัพธ์ & สิ่งที่เรียนรู้</h3><p><br></p>' },
  { id: 'weekly', icon: 'report-detailed', title: 'Weekly Review · รีวิวรายสัปดาห์', desc: 'สรุปสัปดาห์และตั้งเป้าสัปดาห์หน้า', html: '<h2>รีวิวรายสัปดาห์</h2><h3>ตัวเลขสำคัญ</h3><table><tbody><tr><td>P&amp;L</td><td><br></td></tr><tr><td>Win rate</td><td><br></td></tr><tr><td>จำนวนเทรด</td><td><br></td></tr></tbody></table><h3>อะไรได้ผล</h3><p><br></p><h3>อะไรไม่ได้ผล</h3><p><br></p><h3>โฟกัสสัปดาห์หน้า</h3><p><br></p>' },
  { id: 'monthly', icon: 'calendar', title: 'Monthly Review · รีวิวรายเดือน', desc: 'ภาพใหญ่ เป้าหมาย และ Strategy ที่จะเน้น', html: '<h2>รีวิวรายเดือน</h2><h3>ผลงานเทียบเป้าหมาย</h3><p><br></p><h3>Strategy ที่ดีที่สุด / แย่ที่สุด</h3><p><br></p><h3>ความผิดพลาดที่ซ้ำ</h3><p><br></p><h3>เป้าหมายเดือนหน้า</h3><ol><li><br></li></ol>' },
  { id: 'premarket', icon: 'target', title: 'Pre-market Plan · แผนก่อนตลาดเปิด', desc: 'ข่าว โซนราคา และสถานการณ์ที่จะเทรด', html: '<h2>แผนก่อนตลาดเปิด</h2><h3>ข่าวสำคัญวันนี้</h3><ul><li><br></li></ul><h3>โซนราคาสำคัญ</h3><ul><li><br></li></ul><h3>สถานการณ์ A / B</h3><p><br></p><h3>กฎของวันนี้</h3><p>ความเสี่ยงสูงสุด: </p>' },
  { id: 'blank', icon: 'file-plus', title: 'Blank · หน้าว่าง', desc: 'เริ่มจากหน้าว่าง', html: '<p><br></p>' }
];
