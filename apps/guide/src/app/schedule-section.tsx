import {
  activityTone,
  isFocusDay,
  noticeItems,
  notifyAt,
  scheduleRules,
  scheduleWeeks,
  timeParts,
  type ScheduleRow,
} from '@/lib/schedule';

function TimeText({ text }: { text: string }) {
  return timeParts(text).map((part, index) =>
    part.bold ? (
      <strong key={index} className="home-schedule-clock">
        {part.text}
      </strong>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}

function ActivityTags({ names }: { names: string[] }) {
  return (
    <div className="home-schedule-tags">
      {names.map((name) => (
        <span key={name} className={`home-schedule-tag home-schedule-tag--${activityTone(name)}`}>
          {name}
        </span>
      ))}
    </div>
  );
}

function NoticeCell({ row }: { row: ScheduleRow }) {
  const items = noticeItems(row);
  if (items.length === 0) return <span className="muted">—</span>;
  return (
    <div className="home-schedule-notices">
      {items.map((item) => (
        <div key={item.key}>
          <strong className="home-schedule-clock">{item.notify}</strong> {item.label}
        </div>
      ))}
    </div>
  );
}

export function ScheduleSection() {
  return (
    <section className="home-section home-schedule">
      <h2 className="home-section-title">活动安排</h2>
      <p className="home-schedule-lead">战略服 · 2026.11.09 — 12.06</p>

      <article className="home-schedule-card home-schedule-card--rules">
        <header className="home-schedule-head">
          <strong>活动时间说明</strong>
        </header>
        <div className="home-schedule-scroll">
          <table>
            <tbody>
              {scheduleRules.map((rule) => (
                <tr key={rule.name}>
                  <th scope="row">{rule.name}</th>
                  <td>
                    <TimeText text={rule.detail} />
                    {rule.notices.length > 0 ? (
                      <div className="home-schedule-rule-notice">
                        提前半小时通知：
                        {rule.notices.map((point, index) => (
                          <span key={point.phase}>
                            {index > 0 ? '，' : null}
                            <strong className="home-schedule-clock">
                              {point.exact ? point.at : notifyAt(point.at)}
                            </strong>{' '}
                            {point.phase}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {scheduleWeeks.map((week) => (
        <article key={week.title} className="home-schedule-card">
          <header className="home-schedule-head">
            <strong>{week.title}</strong>
            {week.partial ? <span className="home-schedule-partial">部分日期</span> : null}
          </header>
          <div className="home-schedule-scroll">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>星期</th>
                  <th>活动内容</th>
                  <th>活动时间</th>
                  <th>提前半小时通知</th>
                </tr>
              </thead>
              <tbody>
                {week.rows.map((row) => (
                  <tr key={row.date} className={isFocusDay(row.weekday) ? 'is-focus' : undefined}>
                    <td className="home-schedule-date">{row.date}</td>
                    <td>
                      {isFocusDay(row.weekday) ? (
                        <span className="home-schedule-day">{row.weekday}</span>
                      ) : (
                        row.weekday
                      )}
                    </td>
                    <td>
                      <ActivityTags names={row.activities} />
                    </td>
                    <td>
                      <TimeText text={row.time} />
                    </td>
                    <td>
                      <NoticeCell row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}
