const empty = [];
const hunt = [['终末猎杀','全天开放 · 高倍 19:00—20:00','hunt']];
const dragonTime = '19:50 开线 · 20:01 刷龙';
const thursday = [['巨龙讨伐',dragonTime,'dragon'],['霜陨领主','20:45—21:20','boss']];
const saturday = [['巨龙讨伐',dragonTime,'dragon'],['拍卖高原战','20:45—21:20','castle']];
const sunday = [['征服宣令','20:45—21:10 · 21:15—21:40','feast'],['周排名结算','21:00','result']];
const standard = dates => [
  ['周一',dates[0],hunt],['周二',dates[1],hunt],['周三',dates[2],hunt],
  ['周四',dates[3],thursday],['周五',dates[4],hunt],['周六',dates[5],saturday],['周日',dates[6],sunday]
];
const weeks = [
  {label:'第一周',range:'11.09 — 11.15',days:[['周一','11.09',empty],['周二','11.10',empty],['周三','11.11',empty],['周四','11.12',thursday],['周五','11.13',hunt],['周六','11.14',saturday],['周日','11.15',sunday]]},
  {label:'第二周',range:'11.16 — 11.22',days:standard(['11.16','11.17','11.18','11.19','11.20','11.21','11.22'])},
  {label:'第三周',range:'11.23 — 11.29',days:standard(['11.23','11.24','11.25','11.26','11.27','11.28','11.29'])},
  {label:'第四周',range:'11.30 — 12.06',days:standard(['11.30','12.01','12.02','12.03','12.04','12.05','12.06'])}
];
const eventHtml = ([title,time,type]) => `<div class="event ${type}"><strong>${title}</strong><time>${time}</time></div>`;
const dayHtml = ([name,date,events]) => `<article class="day"><div class="day-head"><span class="day-name">${name}</span><span class="date">${date}</span></div>${events.length?events.map(eventHtml).join(''):'<div class="empty">—</div>'}</article>`;
document.querySelector('#schedule-list').innerHTML = weeks.map((week,i)=>`<section class="week-block"><div class="week-divider"><b>${week.label}</b><span>WEEK ${String(i+1).padStart(2,'0')} · ${week.range}</span></div><div class="days">${week.days.map(dayHtml).join('')}</div></section>`).join('');
const observer=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('visible')),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
