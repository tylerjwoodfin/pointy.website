import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { PointingBlackjackProvider } from "./PointingBlackjackProvider";
import "./pointing-blackjack.scss";

const inLiveSession = (pathname: string) => {
  const segs = pathname.replace(/\/+$/, "").split("/");
  return segs.length >= 3 && segs[1] === "pointing-showdown";
};

export const PointingBlackjackLayout: React.FC = () => {
  const { pathname } = useLocation();
  const showTagline = !inLiveSession(pathname);

  return (
    <div className="pointing-blackjack">
      <PointingBlackjackProvider>
        <header className="pointing-blackjack__header">
          <h1 className="pointing-blackjack__title">Pointing Showdown</h1>
          {showTagline ? (
            <p className="pointing-blackjack__tagline">
              Powered by <a href="https://www.tyler.cloud">tyler.cloud</a>; <a href="https://venmo.com/tylerjwoodfin?txn=pay">buy me a chai latte</a>?</p>
          ) : null}
          {inLiveSession(pathname) ? (
            <Link className="pointing-blackjack__back" to="https://tyler.cloud/pointing-showdown">
              ← Lobby
            </Link>
          ) : null}
        </header>
        <main className="pointing-blackjack__main">
          <Outlet />
        </main>
      </PointingBlackjackProvider>
    </div>
  );
};
