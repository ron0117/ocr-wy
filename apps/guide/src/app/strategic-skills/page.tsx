import { STRATEGIC_SKILLS } from '@/lib/strategic-skills';
import './strategic-skills.css';

export default function StrategicSkillsPage() {
  return (
    <div className="strategic-page">
      <header className="page-header strategic-hero">
        <p className="strategic-kicker">STRATEGIC SERVER · 2026.11.12</p>
        <h1>战略服技能查询</h1>
        <p className="muted strategic-intro">
          现版本共 6 个途径拥有专属战略技能。六个技能完整收录；勇气赞歌四、五阶采用官方公告概述，具体数值以游戏内为准。
        </p>
      </header>

      <nav className="strategic-jump" aria-label="按职业快速跳转">
        {STRATEGIC_SKILLS.map((skill) => (
          <a key={skill.name} href={`#${skill.name}`}>{skill.profession}</a>
        ))}
      </nav>

      <div className="strategic-grid">
        {STRATEGIC_SKILLS.map((skill) => (
          <article className="strategic-card" id={skill.name} key={skill.name}>
            <header className="strategic-card-head">
              <img src={skill.icon} width={80} height={80} alt={`${skill.name}技能图标`} />
              <div>
                <p>{skill.pathway} · {skill.profession}</p>
                <h2>{skill.name}</h2>
                <div className="strategic-tags">
                  <span>{skill.cooldown}</span>
                  {skill.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </div>
            </header>
            <p className="strategic-summary">{skill.summary}</p>
            <ol className="strategic-ranks">
              {skill.ranks.map((rank, index) => (
                <li key={rank}><b>{index + 2} 阶</b><span>{rank}</span></li>
              ))}
            </ol>
            <footer><span>{skill.source}</span></footer>
          </article>
        ))}
      </div>

      <aside className="strategic-note">
        <strong>资料口径</strong>
        <p>战士、窥秘人、占卜家采用 Y1S1.4（11 月 12 日）最新数值；其余以当前游戏内技能详情截图补齐。勇气赞歌四、五阶采用官方公告概述，具体数值以游戏内为准。审判者途径目前没有战略技能条目。</p>
      </aside>
    </div>
  );
}
