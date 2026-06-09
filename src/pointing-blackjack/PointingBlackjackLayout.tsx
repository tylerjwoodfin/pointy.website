import React, { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  PointingBlackjackProvider,
  usePointingBlackjack,
} from "./PointingBlackjackProvider";
import { POINTING_SHOWDOWN_TITLE, swapDocumentTitle } from "./documentTitle";
import "./pointing-blackjack.scss";

const inLiveSession = (pathname: string) => {
  const segs = pathname.replace(/\/+$/, "").split("/");
  return segs.length >= 3 && segs[1] === "pointing-showdown";
};

const PointingBlackjackHeader: React.FC<{ showTagline: boolean }> = ({
  showTagline,
}) => {
  const { pathname } = useLocation();
  const { leaveTable } = usePointingBlackjack();
  return (
    <header className="pointing-blackjack__header">
      <h1 className="pointing-blackjack__title">Pointing Showdown</h1>
      {showTagline ? (
        <p className="pointing-blackjack__tagline">
          Powered by <a href="https://www.tyler.cloud">tyler.cloud</a>;{" "}
          <a href="https://venmo.com/tylerjwoodfin?txn=pay">buy me a chai latte</a>?
        </p>
      ) : null}
      {inLiveSession(pathname) ? (
        <Link
          className="pointing-blackjack__back"
          to="/pointing-showdown"
          onClick={() => leaveTable()}
        >
          ← Lobby
        </Link>
      ) : null}
    </header>
  );
};

export const PointingBlackjackLayout: React.FC = () => {
  const { pathname } = useLocation();
  const showTagline = !inLiveSession(pathname);

  useEffect(() => {
    return swapDocumentTitle(POINTING_SHOWDOWN_TITLE);
  }, []);

  return (
    <div className="pointing-blackjack">
      <PointingBlackjackProvider>
        <PointingBlackjackHeader showTagline={showTagline} />
        <main className="pointing-blackjack__main">
          <Outlet />
        </main>
      </PointingBlackjackProvider>
    </div>
  );
};
