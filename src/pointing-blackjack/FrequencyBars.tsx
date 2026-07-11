import React from "react";
import type { VoteValue } from "./types";
import { POINT_VALUES, cardLabel } from "./cards";

type Props = {
  counts: Record<VoteValue, number>;
};

export const FrequencyBars: React.FC<Props> = ({ counts }) => {
  const max = Math.max(1, ...POINT_VALUES.map((v) => counts[v]));

  return (
    <div className="pb-chart" aria-label="Vote frequency">
      <h3 className="pb-chart__title">Frequency</h3>
      <div className="pb-chart__bars">
        {POINT_VALUES.map((v) => {
          const n = counts[v];
          const h = Math.round((n / max) * 100);
          const { main, sub } = cardLabel(v);
          return (
            <div key={v} className="pb-chart__col">
              <div className="pb-chart__bar-wrap">
                <div className="pb-chart__bar" style={{ height: `${h}%` }} title={`${n} votes`} />
              </div>
              <div className="pb-chart__tick">
                <span className="pb-chart__tick-main">{main}</span>
                {sub ? <span className="pb-chart__tick-sub">{sub}</span> : null}
              </div>
              <div className="pb-chart__count">{n}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
